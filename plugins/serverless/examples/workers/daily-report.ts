// 示例: 每日报告 Cron Job
// 每天早上 8 点执行

pb.cron('daily_report', '0 8 * * *', async () => {
    console.log('Starting daily report generation...');
    
    // 获取昨日数据
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // 统计新用户
    const newUsers = await pb.collection('users').getList(1, 1, {
        filter: `created >= "${yesterdayStr}"`
    });
    
    // 统计新订单
    const newOrders = await pb.collection('orders').getList(1, 1, {
        filter: `created >= "${yesterdayStr}"`
    });
    
    // 统计活跃用户
    const activeUsers = await pb.collection('events').getList(1, 1, {
        filter: `created >= "${yesterdayStr}" && type = "login"`
    });
    
    // 生成报告
    const report = {
        date: yesterdayStr,
        metrics: {
            newUsers: newUsers.totalItems,
            newOrders: newOrders.totalItems,
            activeUsers: activeUsers.totalItems
        },
        generatedAt: new Date().toISOString()
    };
    
    // 保存报告
    await pb.collection('reports').create({
        type: 'daily',
        date: yesterdayStr,
        content: JSON.stringify(report)
    });
    
    console.log('Daily report completed:', report);
});
