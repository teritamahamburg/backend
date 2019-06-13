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
  items({
    orders = [],
    likes = [],
    itemEnum = 'NORMAL', // [NORMAL, ALL, ONLY_DELETED]
  }) {
    let query = 'SELECT * FROM (SELECT `i2`.`id`,`i2`.`internalId`,`i2`.`partId`,`i`.`schoolName`,`i`.`name`,`i`.`code`,`i`.`amount`,`i`.`purchasedAt`,`i`.`userId`,`i`.`courseId`,`i`.`checkedAt`,`i`.`roomId`,`i`.`disposalAt`,`i`.`depreciationAt`,`i`.`editUserId`,`i`.`createdAt`,`i2`.`deletedAt`,`user`.`id` AS `user.id`,`user`.`name` AS `user.name`,`editUser`.`id` AS `editUser.id`,`editUser`.`name` AS `editUser.name`,`room`.`id` AS `room.id`,`room`.`number` AS `room.number`,`course`.`id` AS `course.id`,`course`.`name` AS `course.name` FROM (SELECT MAX(ih.id) AS m FROM itemHistories AS ih GROUP BY ih.itemId) AS m  JOIN itemHistories AS i ON m.m = i.id  JOIN users AS user ON i.userId = user.id  JOIN users AS editUser ON i.editUserId = editUser.id  JOIN rooms AS room ON i.roomId = room.id  JOIN courses AS course ON i.courseId = course.id  JOIN items i2 ON i.itemId = i2.id)';
    const replacements = [];
    if (itemEnum !== 'ALL') query += ` WHERE deletedAt IS${itemEnum === 'NORMAL' ? '' : ' NOT'} NULL`;
    if (likes.length > 0) {
      query += `${itemEnum !== 'ALL' ? ' AND ' : ' WHERE '}(${likes
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
      item.createdAt = new Date(item.createdAt).toISOString();
      if (item.deletedAt) item.deletedAt = new Date(item.deletedAt).toISOString();
      return item;
    }));
  },
  csv({
    paranoid = false,
  }) {
    const query = 'SELECT \'"\' || id || \'","\' || internalId || \'","\' || partId || \'","\' || replace(schoolName, \'"\', \'""\') || \'","\' || replace(name, \'"\', \'""\') || \'","\' || replace(code, \'"\', \'""\') || \'","\' || amount || \'","\' || user || \'","\' || edituser || \'","\' || room || \'","\' || course || \'","\' || purchasedAt || \'","\' || ifnull(checkedAt, \'\') || \'","\' || ifnull(disposalAt, \'\') || \'","\' || ifnull(depreciationAt, \'\') || \'","\' || createdAt || \'","\' || ifnull(deletedAt, \'\') || \'"\' as row FROM (SELECT `i2`.`id`, `i2`.`internalId`, `i2`.`partId`, `i`.`schoolName`, `i`.`name`, `i`.`code`, `i`.`amount`, `i`.`purchasedAt`, `i`.`userId`, `i`.`courseId`, `i`.`checkedAt`, `i`.`roomId`, `i`.`disposalAt`, `i`.`depreciationAt`, `i`.`editUserId`, `i`.`createdAt`, `i2`.`deletedAt`, `user`.`name`     AS `user`, `editUser`.`name` AS `editUser`, `room`.`number`   AS `room`, `course`.`name`   AS `course` FROM (SELECT MAX(ih.id) AS m FROM itemHistories AS ih GROUP BY ih.itemId) AS m JOIN itemHistories AS i ON m.m = i.id JOIN users AS user ON i.userId = user.id JOIN users AS editUser ON i.editUserId = editUser.id JOIN rooms AS room ON i.roomId = room.id JOIN courses AS course ON i.courseId = course.id JOIN items i2 ON i.itemId = i2.id)';
    return db.sequelize.query(`${query}${paranoid ? '' : ' WHERE deletedAt IS NULL'} ORDER BY id;`, {
      type: db.Sequelize.QueryTypes.SELECT,
    }).then(rows => rows.map(({ row }) => row).join('\n'))
      .then(str => `id,internalId,partId,schoolName,name,code,amount,user,editUser,room,course,purchasedAt,checkedAt,disposalAt,depreciationAt,createdAt,deletedAt\n${str}`);
  },
};

/**
 * DB
 * @typedef {object} DB
 * @prop {object} items
 * @prop {object} itemHistories
 * @prop {object} users
 * @prop {object} rooms
 * @prop {object} courses
 * @prop {object} sequelize
 * @prop {object} Sequelize
 */
module.exports = db;
