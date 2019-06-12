import uuidv4 from 'uuid/v4';

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

class GraphQLMiddleware {
  constructor(database) {
    const { Query, Mutation, Item } = this;
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
      },
    });
  }

  get Query() {
    return {
      items: (parent, { sort, search }) => this.db.queries.items()
        .orders(sort
          .filter(s => itemsSortProperties.includes(s[0]))
          .map(([col, order]) => [col, order === 'asc' ? 'asc' : 'desc']))
        .likes(search ? [
          ['name', `%${search}%`],
          ['code', `%${search}%`],
          ['schoolName', `%${search}%`],
          ['user.name', `%${search}%`],
          ['editUser.name', `%${search}%`],
          ['course.name', `%${search}%`],
          ['room.number', `%${search}%`],
        ] : [])
        .exec(),
      item: async (parent, { id }) => {
        const item = await this.db.items.findOne({
          paranoid: false,
          where: { id },
          include: [
            {
              model: this.db.itemHistories,
              limit: 1,
              order: [['id', 'desc']],
              include: [
                {
                  model: this.db.users,
                  as: 'user',
                },
                {
                  model: this.db.users,
                  as: 'editUser',
                },
                this.db.rooms,
                this.db.courses,
              ],
            },
          ],
        });
        return item ? ({
          ...item.itemHistories[0].dataValues,
          ...item.dataValues,
        }) : undefined;
      },
    };
  }

  get Mutation() {
    return {
      addItem: async (parent, { data }) => {
        // 事前準備(他テーブルに必要なデータを追加)
        const user = (await this.db.users.findOrCreate({
          where: { name: data.user },
          defaults: { name: data.user },
        }))[0];
        const editUser = data.user === data.editUser ? user : (await this.db.users.findOrCreate({
          where: { name: data.editUser },
          defaults: { name: data.editUser },
        }))[0];
        const room = (await this.db.rooms.findOrCreate({
          where: { number: data.room },
          defaults: { number: data.room },
        }))[0];
        const course = (await this.db.courses.findOrCreate({
          where: { name: data.course },
          defaults: { name: data.course },
        }))[0];

        const item = await this.db.items.create({
          internalId: uuidv4(),
          partId: 0,
        });

        // 実データ挿入
        await this.db.itemHistories.create({
          itemId: item.id,
          ...data,
          userId: user.id,
          courseId: course.id,
          roomId: room.id,
          editUserId: editUser.id,
        });
        return {
          success: true,
        };
      },
      editItem: async (parent, { id, data }) => {
        const len = Object.values(data)
          .filter(v => v !== undefined)
          .length;
        if (len <= 1) { // 1 = editUser
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
        if (item.partId !== 0) {
          return {
            success: false,
            message: 'item is part',
          };
        }
        const edit = {};
        Object.keys(data).forEach((key) => {
          if (data[key] !== undefined) {
            edit[key] = data[key];
          }
        });
        edit.editUserId = (await this.db.users.findOrCreate({
          where: { name: edit.editUser },
          defaults: { name: edit.editUser },
        }))[0].id;
        delete edit.editUser;
        if (edit.room) {
          edit.roomId = (await this.db.rooms.findOrCreate({
            where: { number: edit.room },
            defaults: { number: edit.room },
          }))[0].id;
          delete edit.room;
        }
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
      removeItems: async (parent, { ids }) => {
        const wheres = (await this.db.items.findAll({
          where: {
            id: ids,
          },
        })).map(({ id, partId, internalId }) => (partId === 0 ? { internalId } : { id }));

        await this.db.items.destroy({
          where: {
            [this.db.Sequelize.Op.or]: wheres,
          },
        });
        return {
          success: true,
        };
      },
      addPart: async (parent, { internalId, data }) => {
        if (Object.keys(data).length <= 1) {
          return {
            success: false,
            message: 'change at least one',
          };
        }
        let item = (await this.db.items.findAll({
          paranoid: false,
          attributes: [
            [this.db.sequelize.fn('MAX', this.db.sequelize.col('partId')), 'max'],
            'deletedAt',
          ],
          where: { internalId },
          order: [['id', 'desc']],
          limit: 1,
          include: [
            {
              model: this.db.itemHistories,
              limit: 1,
              order: [['id', 'desc']],
              include: [
                { model: this.db.users, as: 'editUser' },
                this.db.rooms,
              ],
            },
          ],
        }))[0].dataValues;
        if (!item.id) {
          return {
            success: false,
            message: 'parent item not found',
          };
        }
        const { max, deletedAt } = item;
        item = {
          ...item.itemHistories[0].dataValues,
        };
        item.room = item.room.number;
        if (Object.keys(data)
          .filter(k => k !== 'editUser')
          .every(k => data[k] === item[k])) {
          return {
            success: false,
            message: 'part data not change',
          };
        }
        if (item.editUser.name !== data.editUser) {
          item.editUserId = (await this.db.users.findOrCreate({
            where: { name: data.editUser },
            defaults: { name: data.editUser },
          }))[0].id;
        }
        item.name = data.name || item.name;
        if (item.room.number !== data.room) {
          item.roomId = (await this.db.rooms.findOrCreate({
            where: { number: data.room },
            defaults: { number: data.room },
          }))[0].id;
        }
        item.checkedAt = data.checkedAt || item.checkedAt;
        item.itemId = (await this.db.items.create({
          internalId,
          partId: max + 1,
          deletedAt,
        })).id;
        delete item.id;
        delete item.createdAt;
        delete item.updatedAt;
        await this.db.itemHistories.create(item);
        return {
          success: true,
        };
      },
      editPart: async (parent, { id, data }) => {
        if (Object.keys(data).length <= 1) {
          return {
            success: false,
            message: 'change at least one',
          };
        }
        let item = await this.db.items.findOne({
          paranoid: false,
          where: { id },
          include: [
            {
              model: this.db.itemHistories,
              limit: 1,
              order: [['id', 'desc']],
              include: [
                { model: this.db.users, as: 'editUser' },
                this.db.rooms,
              ],
            },
          ],
        });
        if (!item) {
          return {
            success: false,
            message: 'item not found',
          };
        }
        if (item.partId === 0) {
          return {
            success: false,
            message: 'partId is 0, use `editItem` query instead',
          };
        }
        item = item.dataValues.itemHistories[0].dataValues;
        item.room = item.room.number;
        if (Object.keys(data)
          .filter(k => k !== 'editUser')
          .every(k => data[k] === item[k])) {
          return {
            success: false,
            message: 'part data not change',
          };
        }
        if (item.editUser.name !== data.editUser) {
          item.editUserId = (await this.db.users.findOrCreate({
            where: { name: data.editUser },
            defaults: { name: data.editUser },
          }))[0].id;
        }
        item.name = data.name || item.name;
        if (item.room.number !== data.room) {
          item.roomId = (await this.db.rooms.findOrCreate({
            where: { number: data.room },
            defaults: { number: data.room },
          }))[0].id;
        }
        item.checkedAt = data.checkedAt || item.checkedAt;
        delete item.id;
        delete item.createdAt;
        delete item.updatedAt;
        await this.db.itemHistories.create(item);
        return {
          success: true,
        };
      },
    };
  }

  get Item() {
    return {
      histories: async ({ id }) => this.db.itemHistories.findAll({
        attributes: ['id', 'createdAt', 'checkedAt', 'disposalAt', 'depreciationAt'],
        where: { itemId: id },
        order: [['id', 'desc']],
        include: [
          {
            model: this.db.users,
            as: 'editUser',
          },
          this.db.rooms,
        ],
      }),
      parts: async ({ internalId, partId }) => {
        if (partId !== 0) return [];
        const items = await this.db.items.findAll({
          where: {
            internalId,
            partId: {
              [this.db.Sequelize.Op.ne]: 0,
            },
          },
          include: [
            {
              model: this.db.itemHistories,
              limit: 1,
              order: [['id', 'desc']],
              include: [
                {
                  model: this.db.users,
                  as: 'user',
                },
                {
                  model: this.db.users,
                  as: 'editUser',
                },
                this.db.rooms,
                this.db.courses,
              ],
            },
          ],
        });
        return items.map(item => ({
          ...item.itemHistories[0].dataValues,
          ...item.dataValues,
        }));
      },
    };
  }

  middleware(app) {
    this.server.applyMiddleware({ app });
  }
}

export default GraphQLMiddleware;
