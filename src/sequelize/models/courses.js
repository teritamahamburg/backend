module.exports = (sequelize, DataTypes) => sequelize.define('courses', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: 'courses_unique_name',
  },
}, {});
