module.exports = (sequelize, DataTypes) => {
  const rooms = sequelize.define('rooms', {
    number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {});
  /* rooms.associate = function(models) {
    // associations can be defined here
  }; */
  return rooms;
};
