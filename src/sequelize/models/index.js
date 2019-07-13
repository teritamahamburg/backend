const { transform } = require('dottie');

const Sequelize = require('sequelize');
const baseConfig = require('../config/config.js');

const config = baseConfig[process.env.NODE_ENV || 'development'];
const db = {};

let sequelize;
if (config.dialect === 'sqlite') {
  sequelize = new Sequelize(config);
} else if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const context = require.context('./', false, /^(?!.*index).+\.js$/);
context.keys().forEach((module) => {
  const model = context(module)(sequelize, Sequelize, config);
  db[model.name] = model;
});

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// TODO: replace sequelize query
db.queries = {
  selectQuery: `
    SELECT __SELECT__
FROM (SELECT item.id,
             item.name,
             item.code,
             item.amount,
             admin.id       AS \`admin.id\`,
             admin.name     AS \`admin.name\`,
             course.id     AS \`course.id\`,
             course.name   AS \`course.name\`,
             item.purchasedAt,
             item.createdAt,
             item.deletedAt,
             hist.seal,
             room.id       AS \`room.id\`,
             room.number   AS \`room.number\`,
             hist.checkedAt,
             hist.disposalAt,
             hist.depreciationAt
      FROM (SELECT MAX(ih.id) AS m FROM itemHistories AS ih GROUP BY ih.itemId) AS m
               JOIN itemHistories AS hist ON m.m = hist.id
               JOIN rooms AS room ON hist.roomId = room.id
               JOIN items item ON hist.itemId = item.id
               JOIN users AS admin ON item.adminId = admin.id
               JOIN courses AS course ON item.courseId = course.id)
    `.replace(/\n/g, ' ').replace(/ +/g, ' '),
  children(itemId) {
    const query = 'SELECT * FROM (SELECT MAX(id) AS i FROM childHistories WHERE itemId = ? GROUP BY childId) AS c JOIN childHistories AS child ON c.i = child.id;';
    return db.sequelize.query(query, {
      type: Sequelize.QueryTypes.SELECT,
      replacements: [itemId],
    }).then(transform).then(items => items.map((item) => {
      /* eslint-disable no-param-reassign */
      item.createdAt = new Date(item.createdAt);
      if (item.deletedAt) item.deletedAt = new Date(item.deletedAt);
      return item;
    }));
  },
  items({
    orders = [],
    likes = [],
    itemEnum = 'NORMAL', // [NORMAL, ALL, ONLY_DELETED]
  }) {
    let query = db.queries.selectQuery.replace('__SELECT__', '*');
    const replacements = [];
    let where = false;
    if (itemEnum !== 'ALL') {
      query += `${where ? ' AND ' : ' WHERE '}deletedAt IS${itemEnum === 'NORMAL' ? '' : ' NOT'} NULL`;
      where = true;
    }
    if (likes.length > 0) {
      query += `${where ? ' AND ' : ' WHERE '}(${likes
        .map(([col, t]) => {
          replacements.push(t);
          return `\`${col}\` LIKE ?`;
        })
        .join(' OR ')})`;
    }
    if (orders.length > 0) {
      query += ` ORDER BY ${orders
        .map(([col, o]) => `${col} ${o}`)
        .join(', ')}`;
    }
    return db.sequelize.query(`${query};`, {
      type: Sequelize.QueryTypes.SELECT,
      replacements,
    }).then(transform).then(items => items.map((item) => {
      /* eslint-disable no-param-reassign */
      item.purchasedAt = new Date(item.purchasedAt);
      item.createdAt = new Date(item.createdAt).toISOString();
      if (item.deletedAt) item.deletedAt = new Date(item.deletedAt).toISOString();
      return item;
    }));
  },
  csv({
    paranoid = false,
  }) {
    // TODO: children is not includes.
    const query = db.queries.selectQuery.replace('__SELECT__',
      `'"' || id || '","' || ifnull(seal, '') || '","' || '","' || replace(name, '"', '""') || '","' || replace(code, '"', '""') ||
       '","' || amount || '","' || \`admin.name\` || '","' || \`course.name\` || '","' || \`room.number\` || '","' ||
        purchasedAt || '","' || ifnull(checkedAt, '') || '","' || ifnull(disposalAt, '') || '","' ||
       ifnull(depreciationAt, '') || '","' || createdAt || '","' || ifnull(deletedAt, '') || '"' as row`);
    return db.sequelize.query(`${query}${paranoid ? '' : ' WHERE deletedAt IS NULL'} ORDER BY id;`, {
      type: db.Sequelize.QueryTypes.SELECT,
    }).then(rows => rows.map(({ row }) => row).join('\n'))
      .then(rows => ({
        columns: ['id', 'seal', 'name', 'code', 'amount', 'admin', 'course', 'room', 'purchasedAt', 'checkedAt', 'disposalAt', 'depreciationAt', 'createdAt', 'deletedAt'],
        rows,
      }));
  },
};

/**
 * DB
 * @typedef {object} DB
 * @prop {object} items
 * @prop {object} itemHistories
 * @prop {object} childHistories
 * @prop {object} users
 * @prop {object} rooms
 * @prop {object} courses
 * @prop {object} sequelize
 * @prop {object} Sequelize
 */
module.exports = db;
