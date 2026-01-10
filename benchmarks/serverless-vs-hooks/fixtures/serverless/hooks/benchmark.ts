// Serverless DB Hook 性能测试代码
// 放置到 pb_serverless/hooks/benchmark.ts

import { pb, RecordEvent } from '@pocketbase/sdk';

// ============================================================================
// DB Hook 测试 (需要创建 benchmark_serverless collection)
// ============================================================================

pb.onRecordBeforeCreate('benchmark_serverless', async (e: RecordEvent) => {
    // 简单的字段计算
    const value = e.record.get('value') || 0;
    e.record.set('computed', value * 2);
    e.record.set('processed_at', new Date().toISOString());
});

// 可选：更复杂的 hook 测试
pb.onRecordBeforeUpdate('benchmark_serverless', async (e: RecordEvent) => {
    const oldValue = e.record.original().get('value') || 0;
    const newValue = e.record.get('value') || 0;
    
    if (newValue !== oldValue) {
        e.record.set('computed', newValue * 2);
        e.record.set('updated_at', new Date().toISOString());
    }
});
