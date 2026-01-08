// 示例: 数据清理 Cron Job
// 每周日凌晨 2 点执行

pb.cron('weekly_cleanup', '0 2 * * 0', async () => {
    console.log('Starting weekly cleanup...');
    
    // 清理 30 天前的日志
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();
    
    // 批量删除旧日志
    let deletedCount = 0;
    let hasMore = true;
    
    while (hasMore) {
        const oldLogs = await pb.collection('logs').getList(1, 100, {
            filter: `created < "${cutoffDate}"`
        });
        
        if (oldLogs.items.length === 0) {
            hasMore = false;
            break;
        }
        
        for (const log of oldLogs.items) {
            await pb.collection('logs').delete(log.id);
            deletedCount++;
        }
        
        console.log(`Deleted ${deletedCount} old logs so far...`);
    }
    
    // 清理过期的 KV 缓存
    await pb.kv.delete('cache:*');
    
    // 清理临时文件
    const tempFiles = await pb.collection('temp_files').getList(1, 100, {
        filter: `created < "${cutoffDate}"`
    });
    
    for (const file of tempFiles.items) {
        await pb.collection('temp_files').delete(file.id);
    }
    
    console.log(`Weekly cleanup completed. Deleted ${deletedCount} logs and ${tempFiles.items.length} temp files.`);
});
