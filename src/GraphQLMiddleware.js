import fs from 'fs';
import { extname } from 'path';

import { ApolloServer } from 'apollo-server-koa';
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
      }),
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
        return item ? ({
          ...item.itemHistories[0].dataValues,
          ...item.dataValues,
        }) : undefined;
      },
      csv: paranoid => this.db.queries.csv({ paranoid }),
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
        await this.db.itemHistories.create({
          itemId: item.id,
          roomId: room.id,
          seal,
          checkedAt: data.checkedAt,
          disposalAt: data.disposalAt,
          depreciationAt: data.depreciationAt,
        });

        return {
          success: true,
        };
      },
      addItems: async (parent, { data }) => {
        for (let i = 0; i < data.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          const r = await self.addItem(parent, data[i]);
          if (!r.success) return r;
        }
        return { success: true };
      },
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
        edit.seal = seal;
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
      editItems: async (parent, { ids, data }) => {
        for (let i = 0; i < ids.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          const r = await self.editItem(parent, { id: ids[i], data });
          if (!r.success) return r;
        }
        return { success: true };
      },
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
      editChildren: async (parent, { childIds, data }) => {
        for (let i = 0; i < childIds.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          const r = await self.editChild(parent, { childId: childIds[i], data });
          if (!r.success) return r;
        }
        return { success: true };
      },
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
            id: children.map(({ id }) => id),
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
      histories: async ({ id }) => this.db.itemHistories.findAll({
        where: { itemId: id },
        order: [['id', 'desc']],
        include: [
          this.db.rooms,
        ],
      }),
      children: async ({ id, name }) => {
        const children = await this.db.queries.children(id);
        return children.map(child => ({
          ...child,
          name: child.name || name,
        }));
      },
    };
  }

  get ChildItem() {
    return {
      histories: async ({ itemId, childId, name }) => {
        const children = await this.db.childHistories.findAll({
          where: {
            itemId,
            childId,
          },
          order: [
            ['id', 'desc'],
          ],
        });
        return children.map(child => ({
          ...child.dataValues,
          name: child.name || name,
        }));
      },
    };
  }

  middleware(app) {
    this.server.applyMiddleware({ app });
  }
}

export default GraphQLMiddleware;
