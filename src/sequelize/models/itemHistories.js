module.exports = (sequelize, DataTypes) => {
  const itemHistories = sequelize.define('itemHistories', {
    itemId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    seal: {
      type: DataTypes.STRING,
    },
    roomId: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    checkedAt: {
      type: DataTypes.DATE,
    },
    disposalAt: {
      type: DataTypes.DATE,
    },
    depreciationAt: {
      type: DataTypes.DATE,
    },
  }, {});
  itemHistories.associate = ({ items, rooms }) => {
    itemHistories.belongsTo(items, { foreignKey: 'itemId' });
    itemHistories.belongsTo(rooms, { foreignKey: 'roomId' });
  };
  return itemHistories;
};
