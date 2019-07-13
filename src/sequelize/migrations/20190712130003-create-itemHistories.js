module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('item_histories', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    itemId: {
      allowNull: false,
      type: Sequelize.INTEGER,
    },
    seal: {
      type: Sequelize.STRING,
    },
    roomId: {
      allowNull: false,
      type: Sequelize.INTEGER,
    },
    checkedAt: {
      type: Sequelize.DATE,
    },
    disposalAt: {
      type: Sequelize.DATE,
    },
    depreciationAt: {
      type: Sequelize.DATE,
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  }),
  down: queryInterface => queryInterface.dropTable('item_histories'),
};
