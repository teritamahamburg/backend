import fs from 'fs';
import { extname } from 'path';

import { ApolloServer, makeExecutableSchema } from 'apollo-server-koa';
import { GraphQLDate, GraphQLDateTime, GraphQLTime } from 'graphql-iso-date';

import typeDefs from '../schema.graphql';

/**
 * @link {frontend/src/Home.vue}
 */
const itemsSortProperties = [
  'id',
  'amount',
  'purchasedAt',
  'checkedAt',
  'disposalAt',
  'depreciationAt',
];

const util = {
  concatId(itemId, childId) {
    return `${itemId},${childId}`;
  },
  splitId(id) {
    return id.split(',');
  },
};

const mapAsync = (arr, cb) => {
  const result = [];
  let p = Promise.resolve();
  arr.forEach((a) => {
    p = p.then(async () => {
      const data = await cb(a);
      result.push(data);
    });
  });
  return p.then(() => Promise.resolve(result));
};

const convertDate = (date) => {
  if (!date) return null;
  let d = date;
  if (typeof d === 'string') {
    d = new Date(date);
  }
  return d.toISOString().substring(0, 10);
};

const itemToQL = item => (item ? ({
  ...item,
  checkedAt: convertDate(item.checkedAt),
  disposalAt: convertDate(item.disposalAt),
  depreciationAt: convertDate(item.depreciationAt),
}) : undefined);

class GraphQLMiddleware {
  constructor(database) {
    const {
      Query,
      Mutation,
      Item,
      ChildItem,
    } = this;
    this.db = database;
    this.server = new ApolloServer({
      schema: makeExecutableSchema({
        typeDefs,
        resolvers: {
          Date: GraphQLDate,
          Time: GraphQLTime,
          DateTime: GraphQLDateTime,
          Query,
          Mutation,
          Item,
          ChildItem,
        },
      }),
    });
  }

  get Query() {
    return {
      items: (parent, { sort, search, itemEnum }) => this.db.queries.items({
        likes: search ? [
          ['name', `%${search}%`],
          ['code', `%${search}%`],
          ['admin.name', `%${search}%`],
          ['course.name', `%${search}%`],
          ['room.number', `%${search}%`],
        ] : [],
        orders: sort
          .filter(s => itemsSortProperties.includes(s[0]))
          .map(([col, order]) => [col, order === 'asc' ? 'asc' : 'desc']),
        itemEnum,
      }).then(items => items.map(i => itemToQL(i))),
      item: async (parent, { id }) => {
        const item = await this.db.items.findOne({
          paranoid: false,
          where: { id },
          include: [
            {
              model: this.db.users,
              as: 'admin',
            },
            this.db.courses,
            {
              model: this.db.itemHistories,
              limit: 1,
              order: [['id', 'desc']],
              include: [
                this.db.rooms,
              ],
            },
          ],
        });
        return item ? itemToQL({
          ...item.itemHistories[0].dataValues,
          ...item.dataValues,
        }) : undefined;
      },
      children: (parent, { search, childEnum }) => this.db.queries.children({
        childEnum,
        likes: search ? [
          ['name', `%${search}%`],
          ['room.number', `%${search}%`],
        ] : [],
      }).then(children => children.map((child) => {
        /* eslint-disable no-param-reassign */
        child.internalId = child.id;
        child.id = util.concatId(child.itemId, child.childId);
        return itemToQL(child);
      })),
      child: async (parent, { childId: id }) => {
        const [itemId, childId] = util.splitId(id);
        return this.db.childHistories.findOne({
          where: {
            itemId,
            childId,
          },
          order: [['id', 'desc']],
          limit: 1,
        }).then(c => itemToQL(c.dataValues));
      },
      csv: (parent, { paranoid }) => this.db.queries.csv({ paranoid }),
      users: () => this.db.users.findAll(),
    };
  }

  get Mutation() {
    const self = {
      // item Mutations
      addItem: async (parent, { data }) => {
        // 事前準備(他テーブルに必要なデータを追加)
        const admin = (await this.db.users.findOrCreate({
          where: { name: data.admin },
          defaults: { name: data.admin },
        }))[0];
        const course = (await this.db.courses.findOrCreate({
          where: { name: data.course },
          defaults: { name: data.course },
        }))[0];
        const room = (await this.db.rooms.findOrCreate({
          where: { number: data.room },
          defaults: { number: data.room },
        }))[0];

        let item;
        try {
          item = await this.db.items.create({
            name: data.name,
            code: data.code,
            amount: Number(data.amount),
            adminId: admin.id,
            courseId: course.id,
            purchasedAt: data.purchasedAt,
            createdAt: data.createdAt,
          });
        } catch (e) {
          return {
            success: false,
            message: 'code is not unique',
          };
        }

        let seal = null;
        // シールのダウンロード
        if (data.seal) {
          await fs.promises.mkdir('storage/seal', { recursive: true });
          const { filename, mimetype, createReadStream } = await data.seal;

          if (!mimetype.startsWith('image/')) return { success: false, message: 'seal must image' };
          const dest = fs.createWriteStream(`storage/seal/${data.code}${extname(filename)}`);
          await new Promise((resolve) => {
            seal = extname(filename);
            createReadStream().pipe(dest).on('finish', resolve);
          });
        }

        if (data.amount > 1) {
          await this.db.childHistories.bulkCreate([...Array(data.amount).keys()].map(i => ({
            itemId: item.id,
            childId: i + 1,
          })));
        }

        // 実データ挿入
        const itemHistory = await this.db.itemHistories.create({
          itemId: item.id,
          roomId: room.id,
          seal,
          checkedAt: data.checkedAt,
          disposalAt: data.disposalAt,
          depreciationAt: data.depreciationAt,
        });

        return {
          success: true,
          item: itemToQL({
            ...itemHistory.dataValues,
            ...item.dataValues,
          }),
        };
      },
      addItems: (parent, { data }) => mapAsync(
        data,
        d => self.addItem(parent, { data: d }),
      ),
      editItem: async (parent, { id, data }) => {
        const len = Object.values(data)
          .filter(v => v !== undefined)
          .length;
        if (len <= 0) {
          return {
            success: false,
            message: 'edit param needs at least 1',
          };
        }
        const item = await this.db.items.findOne({
          where: { id },
          include: [
            {
              model: this.db.itemHistories,
              limit: 1,
              order: [['id', 'desc']],
            },
          ],
        });
        if (!item) {
          return {
            success: false,
            message: 'item not found',
          };
        }
        let seal = null;
        // シールのダウンロード
        if (data.seal) {
          await fs.promises.mkdir('storage/seal', { recursive: true });
          const { filename, mimetype, createReadStream } = await data.seal;

          if (!mimetype.startsWith('image/')) return { success: false, message: 'seal must image' };
          const dest = fs.createWriteStream(`storage/seal/${item.code}${extname(filename)}`);
          await new Promise((resolve) => {
            seal = extname(filename);
            createReadStream().pipe(dest).on('finish', resolve);
          });
        }
        const edit = {};
        Object.keys(data).forEach((key) => {
          if (data[key] !== undefined) {
            edit[key] = data[key];
          }
        });
        if (edit.room) {
          edit.roomId = (await this.db.rooms.findOrCreate({
            where: { number: edit.room },
            defaults: { number: edit.room },
          }))[0].id;
          delete edit.room;
        }
        if (seal) edit.seal = seal;
        await this.db.itemHistories.create({
          ...item.dataValues.itemHistories[0].dataValues,
          ...edit,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
        });
        return {
          success: true,
        };
      },
      editItems: (parent, { ids, data }) => mapAsync(
        ids,
        id => self.editItem(parent, { id, data }),
      ),
      removeItems: async (parent, { ids }) => {
        await this.db.items.destroy({
          where: {
            id: ids,
          },
        });
        return {
          success: true,
        };
      },
      restoreItem: async (parent, { id }) => {
        const item = await this.db.items.findOne({
          paranoid: false,
          attributes: ['deletedAt'],
          where: { id },
        });
        if (!item) {
          return {
            success: false,
            message: 'item not found',
          };
        }
        if (!item.deletedAt) {
          return {
            success: false,
            message: 'item not deleted',
          };
        }
        await this.db.items.restore({
          where: { id },
        });
        return {
          success: true,
        };
      },
      // child Mutations
      editChild: async (parent, { childId: id, data }) => {
        if (Object.keys(data).filter(k => !['createdAt'].includes(k)).length === 0) {
          return {
            success: false,
            message: 'change at least one',
          };
        }
        const [itemId, childId] = util.splitId(id);
        const item = await this.db.items.findOne({
          paranoid: false,
          where: {
            id: itemId,
          },
          include: [
            {
              model: this.db.childHistories,
              where: { childId },
              limit: 1,
              order: [['id', 'desc']],
              include: [
                this.db.rooms,
              ],
            },
          ],
        });
        if (!item || item.childHistories.length === 0) {
          return {
            success: false,
            message: 'item not found',
          };
        }
        const child = item.dataValues.childHistories[0];
        const edit = {
          itemId,
          childId,
          name: child.name,
          roomId: child.room ? child.room.id : null,
          room: child.room ? child.room.number : null,
          checkedAt: child.checkedAt,
          createdAt: data.createdAt,
        };
        if (Object.keys(data)
          .filter(k => !['createdAt'].includes(k))
          .every(k => data[k] === edit[k])) {
          return {
            success: false,
            message: 'part data not change',
          };
        }
        edit.name = data.name || edit.name;
        if (data.room && edit.room !== data.room) {
          edit.roomId = (await this.db.rooms.findOrCreate({
            where: { number: data.room },
            defaults: { number: data.room },
          }))[0].id;
        }
        edit.checkedAt = data.checkedAt || edit.checkedAt;
        await this.db.childHistories.create(edit);
        return {
          success: true,
        };
      },
      editChildren: (parent, { childIds, data }) => mapAsync(
        childIds,
        childId => self.editChild(parent, { childId, data }),
      ),
      removeChildren: async (parent, { childIds }) => {
        const ids = childIds.map((a) => {
          const [itemId, childId] = util.splitId(a);
          return { itemId, childId };
        });
        await this.db.childHistories.destroy({
          where: {
            [this.db.Sequelize.Op.or]: ids,
          },
        });
        return {
          success: true,
        };
      },
      restoreChild: async (parent, { childId: id }) => {
        const [itemId, childId] = util.splitId(id);
        const children = await this.db.childHistories.findAll({
          paranoid: false,
          attributes: ['id', 'deletedAt'],
          where: { itemId, childId },
        });
        if (children.length === 0) {
          return {
            success: false,
            message: 'child item not found',
          };
        }
        await this.db.childHistories.restore({
          where: {
            id: children.map(c => c.id),
          },
        });
        return {
          success: true,
        };
      },
    };
    return self;
  }

  get Item() {
    return {
      histories: async ({ id }) => {
        const items = await this.db.itemHistories.findAll({
          where: { itemId: id },
          order: [['id', 'desc']],
          include: [
            this.db.rooms,
          ],
        });
        return items.slice(1);
      },
      children: async ({ id }) => {
        const children = await this.db.queries.children({ itemId: id });
        return children.map(child => ({
          ...child,
          id: util.concatId(id, child.childId),
          internalId: child.id,
        }));
      },
    };
  }

  get ChildItem() {
    return {
      histories: async ({ itemId, childId }) => {
        const children = await this.db.childHistories.findAll({
          where: {
            itemId,
            childId,
          },
          order: [
            ['id', 'desc'],
          ],
        });
        return children.slice(1).map(child => ({
          ...child.dataValues,
          id: util.concatId(itemId, child.childId),
          internalId: child.id,
        }));
      },
      item: ({ itemId }) => this.Query.item(undefined, { id: itemId }),
    };
  }

  middleware(app) {
    this.server.applyMiddleware({ app });
  }
}

export default GraphQLMiddleware;
