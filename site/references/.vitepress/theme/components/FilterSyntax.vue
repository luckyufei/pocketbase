<script setup lang="ts">
import { useRoute } from 'vitepress'
import { computed } from 'vue'

const route = useRoute()
const isZh = computed(() => route.path.startsWith('/zh/'))

const texts = computed(() => {
  if (isZh.value) {
    return {
      operator: '操作符',
      example: '示例',
      description: '说明',
      equal: '等于',
      notEqual: '不等于',
      greater: '大于',
      greaterEqual: '大于等于',
      less: '小于',
      lessEqual: '小于等于',
      contains: '包含 (LIKE %value%)',
      notContains: '不包含',
      arrayAny: '数组包含任一',
      arrayNotAny: '数组不包含任一',
      arrayAnyContains: '数组任一包含',
      arrayAnyNotContains: '数组任一不包含',
      and: '逻辑与',
      or: '逻辑或'
    }
  }
  return {
    operator: 'Operator',
    example: 'Example',
    description: 'Description',
    equal: 'Equal',
    notEqual: 'Not equal',
    greater: 'Greater than',
    greaterEqual: 'Greater than or equal',
    less: 'Less than',
    lessEqual: 'Less than or equal',
    contains: 'Contains (LIKE %value%)',
    notContains: 'Not contains',
    arrayAny: 'Array contains any',
    arrayNotAny: 'Array not contains any',
    arrayAnyContains: 'Any element contains',
    arrayAnyNotContains: 'Any element not contains',
    and: 'Logical AND',
    or: 'Logical OR'
  }
})
</script>

<template>
  <div class="filter-syntax">
    <table>
      <thead>
        <tr>
          <th>{{ texts.operator }}</th>
          <th>{{ texts.example }}</th>
          <th>{{ texts.description }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>=</code></td>
          <td><code>status = 'active'</code></td>
          <td>{{ texts.equal }}</td>
        </tr>
        <tr>
          <td><code>!=</code></td>
          <td><code>status != 'deleted'</code></td>
          <td>{{ texts.notEqual }}</td>
        </tr>
        <tr>
          <td><code>&gt;</code></td>
          <td><code>age &gt; 18</code></td>
          <td>{{ texts.greater }}</td>
        </tr>
        <tr>
          <td><code>&gt;=</code></td>
          <td><code>age &gt;= 18</code></td>
          <td>{{ texts.greaterEqual }}</td>
        </tr>
        <tr>
          <td><code>&lt;</code></td>
          <td><code>age &lt; 65</code></td>
          <td>{{ texts.less }}</td>
        </tr>
        <tr>
          <td><code>&lt;=</code></td>
          <td><code>age &lt;= 65</code></td>
          <td>{{ texts.lessEqual }}</td>
        </tr>
        <tr>
          <td><code>~</code></td>
          <td><code>name ~ 'john'</code></td>
          <td>{{ texts.contains }}</td>
        </tr>
        <tr>
          <td><code>!~</code></td>
          <td><code>name !~ 'test'</code></td>
          <td>{{ texts.notContains }}</td>
        </tr>
        <tr>
          <td><code>?=</code></td>
          <td><code>roles ?= 'admin'</code></td>
          <td>{{ texts.arrayAny }}</td>
        </tr>
        <tr>
          <td><code>?!=</code></td>
          <td><code>roles ?!= 'guest'</code></td>
          <td>{{ texts.arrayNotAny }}</td>
        </tr>
        <tr>
          <td><code>?~</code></td>
          <td><code>tags ?~ 'dev'</code></td>
          <td>{{ texts.arrayAnyContains }}</td>
        </tr>
        <tr>
          <td><code>?!~</code></td>
          <td><code>tags ?!~ 'test'</code></td>
          <td>{{ texts.arrayAnyNotContains }}</td>
        </tr>
        <tr>
          <td><code>&amp;&amp;</code></td>
          <td><code>a = 1 &amp;&amp; b = 2</code></td>
          <td>{{ texts.and }}</td>
        </tr>
        <tr>
          <td><code>||</code></td>
          <td><code>a = 1 || b = 2</code></td>
          <td>{{ texts.or }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
