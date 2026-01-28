<script setup lang="ts">
import { ref, useSlots, computed } from 'vue'

interface Props {
  tabs?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  tabs: () => ['JavaScript', 'Dart']
})

const activeTab = ref(0)
const slots = useSlots()

// Detect if using Go mode (when 'go' slot exists)
const isGoMode = computed(() => !!slots.go)

// Dynamic tabs based on mode
const displayTabs = computed(() => {
  if (isGoMode.value) {
    return ['Go', 'JavaScript']
  }
  return props.tabs
})

function setActiveTab(index: number) {
  activeTab.value = index
}
</script>

<template>
  <div class="code-tabs">
    <div class="tabs">
      <button
        v-for="(tab, index) in displayTabs"
        :key="tab"
        :class="['tab', { active: activeTab === index }]"
        @click="setActiveTab(index)"
      >
        {{ tab }}
      </button>
    </div>
    <div class="tab-panels">
      <div
        v-for="(tab, index) in displayTabs"
        :key="tab"
        :class="['tab-content', { active: activeTab === index }]"
      >
        <slot :name="`tab-${index}`" />
        <!-- Go + JavaScript mode -->
        <slot v-if="isGoMode && index === 0" name="go" />
        <slot v-if="isGoMode && index === 1" name="js" />
        <!-- JavaScript + Dart mode (default) -->
        <slot v-if="!isGoMode && index === 0" name="js" />
        <slot v-if="!isGoMode && index === 1" name="dart" />
      </div>
    </div>
  </div>
</template>
