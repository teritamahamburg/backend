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
