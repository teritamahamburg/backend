const { transform } = require('dottie');

const Sequelize = require('sequelize');
const baseConfig = require('../config/config.js');

const env = process.env.NODE_ENV || 'development';
const config = baseConfig[env];
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
  // language=TEXT
  selectQuery: `SELECT __SELECT__
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
               JOIN courses AS course ON item.courseId = course.id)`.replace(/\n/g, ' ').replace(/ +/g, ' '),
  // language=TEXT
  childSelectQuery: `SELECT
          child.id,
          child.itemId,
          child.childId,
          child.name,
          child.checkedAt,
          r.id AS \`room.id\`,
          r.number AS \`room.number\`,
          child.createdAt,
          child.deletedAt
      FROM (SELECT MAX(c.id) AS i FROM childHistories AS c __INNER_ATTR__) AS ch
               JOIN childHistories AS child ON ch.i = child.id
               LEFT OUTER JOIN rooms r on child.roomId = r.id`.replace(/\n/g, ' ').replace(/ +/g, ' '),
  children({
    itemId,
    childEnum = 'NORMAL',
    likes = [],
  }) {
    let queryResult;
    if (itemId) {
      const query = `${db.queries.childSelectQuery.replace('__INNER_ATTR__', 'WHERE itemId = ? GROUP BY c.childId')} WHERE child.deletedAt is ${childEnum === 'NORMAL' ? '' : 'not '}null;`;
      queryResult = db.sequelize.query(query, {
        type: Sequelize.QueryTypes.SELECT,
        replacements: [itemId],
      });
    } else if (childEnum === 'ONLY_DELETED') {
      const query = `${db.queries.childSelectQuery.replace('__INNER_ATTR__', 'GROUP BY c.itemId, c.childId')} WHERE child.deletedAt is not null;`;
      queryResult = db.sequelize.query(query, {
        type: Sequelize.QueryTypes.SELECT,
      });
    } else if (childEnum === 'NORMAL') {
      let query = `${db.queries.childSelectQuery.replace('__INNER_ATTR__', 'GROUP BY c.itemId, c.childId')} WHERE child.deletedAt is null`;
      const replacements = [];
      if (likes.length > 0) {
        query += ` AND (${likes
          .map(([col, t]) => {
            replacements.push(t);
            return `\`${col}\` LIKE ?`;
          })
          .join(' OR ')})`;
      }
      queryResult = db.sequelize.query(`${query};`, {
        type: Sequelize.QueryTypes.SELECT,
        replacements,
      });
    }
    if (queryResult) {
      return queryResult.then(transform).then(items => items.map((item) => {
        /* eslint-disable no-param-reassign */
        if (!item.room.id) item.room = null;
        item.createdAt = new Date(item.createdAt).toISOString();
        if (item.checkedAt) item.checkedAt = new Date(item.checkedAt);
        if (item.deletedAt) item.deletedAt = new Date(item.deletedAt).toISOString();
        return item;
      }));
    }
    return [];
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
  async csv({
    paranoid = false,
  }) {
    const itemQuery = db.queries.selectQuery.replace('__SELECT__',
      `'"' || id || '","","' || ifnull(seal, '') || '","' || replace(name, '"', '""') || '","' || replace(code, '"', '""') ||
       '","' || amount || '","' || \`admin.name\` || '","' || \`course.name\` || '","' || \`room.number\` || '","' ||
        purchasedAt || '","' || ifnull(checkedAt, '') || '","' || ifnull(disposalAt, '') || '","' ||
       ifnull(depreciationAt, '') || '","' || createdAt || '","' || ifnull(deletedAt, '') || '"' as row`);
    const itemRows = await db.sequelize.query(`${itemQuery}${paranoid ? '' : ' WHERE deletedAt IS NULL'} ORDER BY id;`, {
      type: db.Sequelize.QueryTypes.SELECT,
    }).then(rows => rows.map(({ row }) => row).join('\n'));
    const childSelect = '\'"\' || itemId || \'","\' || childId || \'","","\' || replace(ifnull(name, \'\'), \'"\', \'""\') || \'","","","","","\' || ifnull(`room.number`, \'\') || \'","","\' || ifnull(checkedAt, \'\') || \'","","","\' || createdAt || \'","\' || ifnull(deletedAt, \'\') || \'"\' as row';

    // language=TEXT
    const childQuery = `SELECT ${childSelect} FROM (${db.queries.childSelectQuery.replace('__INNER_ATTR__', 'GROUP BY c.itemId, c.childId')}${paranoid ? '' : ' WHERE child.deletedAt IS NULL'}) ORDER BY itemId, childId;`;

    const childRows = await db.sequelize.query(childQuery, {
      type: db.Sequelize.QueryTypes.SELECT,
    }).then(rows => rows.map(({ row }) => row).join('\n'));
    return {
      columns: ['itemId', 'childId', 'seal', 'name', 'code', 'amount', 'admin', 'course', 'room', 'purchasedAt', 'checkedAt', 'disposalAt', 'depreciationAt', 'createdAt', 'deletedAt'],
      rows: `${itemRows}\n${childRows}`,
    };
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
 * @prop {object} queries
 * @prop {object} sequelize
 * @prop {object} Sequelize
 */
module.exports = db;
