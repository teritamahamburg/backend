module.exports = (sequelize, DataTypes) => {
  const items = sequelize.define('items', {
    internalId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'id',
    },
    partId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: 'id',
    },
    seal: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    paranoid: true,
  });
  items.associate = ({ itemHistories }) => {
    items.hasMany(itemHistories, {
      foreignKey: 'itemId',
    });
  };
  return items;
};
