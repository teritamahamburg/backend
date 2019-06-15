module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('items', 'seal', {
      type: Sequelize.STRING,
      after: 'partId',
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('items', 'seal');
  },
};
