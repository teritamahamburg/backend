module.exports = (sequelize, DataTypes) => {
  const users = sequelize.define('users', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'users_unique_name',
    },
  }, {});
  return users;
};
