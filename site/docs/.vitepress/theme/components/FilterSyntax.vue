<script setup lang="ts">
// FilterSyntax 组件 - 展示 PocketBase 过滤器语法
</script>

<template>
  <div class="filter-syntax">
    <table>
      <thead>
        <tr>
          <th>操作符</th>
          <th>示例</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>=</code></td>
          <td><code>status = 'active'</code></td>
          <td>等于</td>
        </tr>
        <tr>
          <td><code>!=</code></td>
          <td><code>status != 'deleted'</code></td>
          <td>不等于</td>
        </tr>
        <tr>
          <td><code>&gt;</code></td>
          <td><code>age &gt; 18</code></td>
          <td>大于</td>
        </tr>
        <tr>
          <td><code>&gt;=</code></td>
          <td><code>age &gt;= 18</code></td>
          <td>大于等于</td>
        </tr>
        <tr>
          <td><code>&lt;</code></td>
          <td><code>age &lt; 65</code></td>
          <td>小于</td>
        </tr>
        <tr>
          <td><code>&lt;=</code></td>
          <td><code>age &lt;= 65</code></td>
          <td>小于等于</td>
        </tr>
        <tr>
          <td><code>~</code></td>
          <td><code>name ~ 'john'</code></td>
          <td>包含 (LIKE %value%)</td>
        </tr>
        <tr>
          <td><code>!~</code></td>
          <td><code>name !~ 'test'</code></td>
          <td>不包含</td>
        </tr>
        <tr>
          <td><code>?=</code></td>
          <td><code>roles ?= 'admin'</code></td>
          <td>数组包含任一</td>
        </tr>
        <tr>
          <td><code>?!=</code></td>
          <td><code>roles ?!= 'guest'</code></td>
          <td>数组不包含任一</td>
        </tr>
        <tr>
          <td><code>?~</code></td>
          <td><code>tags ?~ 'dev'</code></td>
          <td>数组任一包含</td>
        </tr>
        <tr>
          <td><code>?!~</code></td>
          <td><code>tags ?!~ 'test'</code></td>
          <td>数组任一不包含</td>
        </tr>
        <tr>
          <td><code>&amp;&amp;</code></td>
          <td><code>a = 1 &amp;&amp; b = 2</code></td>
          <td>逻辑与</td>
        </tr>
        <tr>
          <td><code>||</code></td>
          <td><code>a = 1 || b = 2</code></td>
          <td>逻辑或</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
