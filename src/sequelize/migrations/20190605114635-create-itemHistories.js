module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('itemHistories', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    itemId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    schoolName: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    code: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    amount: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    purchasedAt: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    courseId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    checkedAt: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
    roomId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    disposalAt: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
    depreciationAt: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },
    editUserId: {
      type: Sequelize.INTEGER,
      allowNull: false,
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
  down: queryInterface => queryInterface.dropTable('itemHistories'),
};
