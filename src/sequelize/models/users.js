module.exports = (sequelize, DataTypes) => {
  const users = sequelize.define('users', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {});
  /* users.associate = function (models) {
    // associations can be defined here
  }; */
  return users;
};
