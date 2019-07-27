module.exports = (sequelize, DataTypes) => sequelize.define('users', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: 'users_unique_name',
  },
}, {});
