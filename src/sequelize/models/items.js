module.exports = (sequelize, DataTypes) => {
  const items = sequelize.define('items', {
    name: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    code: {
      allowNull: false,
      unique: 'code',
      type: DataTypes.STRING,
    },
    amount: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    adminId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    courseId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    purchasedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  }, {
    paranoid: true,
  });
  items.associate = ({
    itemHistories,
    childHistories,
    users,
    courses,
  }) => {
    items.hasMany(itemHistories, {
      foreignKey: 'itemId',
    });
    items.hasMany(childHistories, {
      foreignKey: 'itemId',
    });
    items.belongsTo(users, {
      as: 'admin',
      foreignKey: 'adminId',
    });
    items.belongsTo(courses, { foreignKey: 'courseId' });
  };
  return items;
};
