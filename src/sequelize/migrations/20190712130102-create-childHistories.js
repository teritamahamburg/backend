module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('child_histories', {
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
    childId: {
      allowNull: false,
      type: Sequelize.INTEGER,
    },
    name: {
      type: Sequelize.STRING,
    },
    roomId: {
      type: Sequelize.INTEGER,
    },
    checkedAt: {
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
    deletedAt: {
      type: Sequelize.DATE,
    },
  }),
  down: queryInterface => queryInterface.dropTable('child_histories'),
};
