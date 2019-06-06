module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('items', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    internalId: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: 'id',
    },
    partId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: 'id',
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
  down: queryInterface => queryInterface.dropTable('items'),
};
