module.exports = (sequelize, DataTypes) => {
  const childHistories = sequelize.define('childHistories', {
    itemId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    childId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    name: {
      type: DataTypes.STRING,
    },
    roomId: {
      type: DataTypes.INTEGER,
    },
    checkedAt: {
      type: DataTypes.DATE,
    },
  }, {
    paranoid: true,
  });
  childHistories.associate = ({ items, rooms }) => {
    childHistories.belongsTo(items, { foreignKey: 'itemId' });
    childHistories.belongsTo(rooms, { foreignKey: 'roomId' });
  };
  return childHistories;
};
