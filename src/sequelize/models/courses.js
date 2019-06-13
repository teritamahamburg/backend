module.exports = (sequelize, DataTypes) => {
  const courses = sequelize.define('courses', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'courses_unique_name',
    },
  }, {});
  return courses;
};
