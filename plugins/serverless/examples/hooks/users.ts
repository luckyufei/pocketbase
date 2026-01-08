// 示例: 用户集合的 DB Hooks

// 创建前验证
pb.onRecordBeforeCreate('users', async (e) => {
    // 验证邮箱域名
    const email = e.record.get('email') as string;
    if (!email.endsWith('@company.com')) {
        throw new Error('Only company emails allowed');
    }
    
    // 自动填充字段
    e.record.set('created_by', e.auth?.id);
    e.record.set('status', 'pending');
    
    console.log('User creation validated:', email);
});

// 创建后发送欢迎邮件
pb.onRecordAfterCreate('users', async (e) => {
    // 发送欢迎邮件任务入队
    await pb.jobs.enqueue('send_welcome_email', { 
        userId: e.record.id,
        email: e.record.get('email')
    });
    
    console.log('Welcome email job enqueued for:', e.record.id);
});

// 更新前验证
pb.onRecordBeforeUpdate('users', async (e) => {
    // 记录更新者
    e.record.set('updated_by', e.auth?.id);
});

// 删除前清理
pb.onRecordBeforeDelete('users', async (e) => {
    // 删除用户相关数据
    console.log('Cleaning up data for user:', e.record.id);
    
    // 使用事务确保数据一致性
    await pb.tx(async (tx) => {
        // 删除用户的帖子
        const posts = await tx.collection('posts').getList(1, 100, {
            filter: `author = "${e.record.id}"`
        });
        
        for (const post of posts.items) {
            await tx.collection('posts').delete(post.id);
        }
    });
});
