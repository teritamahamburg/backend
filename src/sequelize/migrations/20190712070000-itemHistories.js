module.exports = {
  up: async (queryInterface) => {
    // 学校名の削除
    await queryInterface.removeColumn('itemHistories', 'schoolName');

    // 購入者を管理者へ
    await queryInterface.renameColumn('itemHistories',
      'userId', 'adminId');
    // 編集者を削除
    await queryInterface.removeColumn('itemHistories', 'editUserId');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('itemHistories', 'schoolName', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'ss',
    });
    await queryInterface.renameColumn('itemHistories',
      'adminId', 'userId');

    await queryInterface.addColumn('itemHistories', 'editUserId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
};
