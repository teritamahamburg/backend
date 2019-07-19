module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('items', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    name: {
      allowNull: false,
      type: Sequelize.STRING,
    },
    code: {
      allowNull: false,
      unique: 'code',
      type: Sequelize.STRING,
    },
    amount: {
      allowNull: false,
      type: Sequelize.INTEGER,
    },
    adminId: {
      allowNull: false,
      type: Sequelize.INTEGER,
    },
    courseId: {
      allowNull: false,
      type: Sequelize.INTEGER,
    },
    purchasedAt: {
      allowNull: false,
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
  down: queryInterface => queryInterface.dropTable('items'),
};
