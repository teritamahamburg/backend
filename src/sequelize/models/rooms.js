module.exports = (sequelize, DataTypes) => sequelize.define('rooms', {
  number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: 'rooms_unique_number',
  },
}, {});
