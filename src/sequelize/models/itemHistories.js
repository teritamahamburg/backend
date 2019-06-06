module.exports = (sequelize, DataTypes) => {
  const itemHistories = sequelize.define('itemHistories', {
    itemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    schoolName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    purchasedAt: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    courseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    checkedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    roomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    disposalAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    depreciationAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    editUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {});
  itemHistories.associate = ({
    rooms,
    courses,
    users,
    items,
  }) => {
    itemHistories.belongsTo(items, { foreignKey: 'itemId' });
    itemHistories.belongsTo(users, {
      as: 'user',
      foreignKey: 'userId',
    });
    itemHistories.belongsTo(users, {
      as: 'editUser',
      foreignKey: 'editUserId',
    });
    itemHistories.belongsTo(courses, { foreignKey: 'courseId' });
    itemHistories.belongsTo(rooms, { foreignKey: 'roomId' });
  };
  return itemHistories;
};
