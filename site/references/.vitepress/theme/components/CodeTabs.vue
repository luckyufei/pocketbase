<script setup lang="ts">
import { ref, useSlots } from 'vue'

interface Props {
  tabs?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  tabs: () => ['Go', 'JavaScript']
})

const activeTab = ref(0)
const slots = useSlots()

function setActiveTab(index: number) {
  activeTab.value = index
}
</script>

<template>
  <div class="code-tabs">
    <div class="tabs">
      <button
        v-for="(tab, index) in tabs"
        :key="tab"
        :class="['tab', { active: activeTab === index }]"
        @click="setActiveTab(index)"
      >
        {{ tab }}
      </button>
    </div>
    <div class="tab-panels">
      <div
        v-for="(tab, index) in tabs"
        :key="tab"
        :class="['tab-content', { active: activeTab === index }]"
      >
        <slot :name="`tab-${index}`" />
        <slot v-if="index === 0" name="go" />
        <slot v-if="index === 1" name="js" />
      </div>
    </div>
  </div>
</template>
