module.exports = (sequelize, DataTypes) => {
  const courses = sequelize.define('courses', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {});
  /* courses.associate = function(models) {
    // associations can be defined here
  }; */
  return courses;
};
