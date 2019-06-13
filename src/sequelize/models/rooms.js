module.exports = (sequelize, DataTypes) => {
  const rooms = sequelize.define('rooms', {
    number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: 'rooms_unique_number',
    },
  }, {});
  return rooms;
};
