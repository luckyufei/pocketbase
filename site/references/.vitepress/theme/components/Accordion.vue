<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title: string
  open?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  open: false
})

const isOpen = ref(props.open)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div :class="['accordion', { open: isOpen }]">
    <div class="accordion-header" @click="toggle">
      <span>{{ title }}</span>
      <svg
        class="accordion-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
    <div class="accordion-content">
      <div class="accordion-body">
        <slot />
      </div>
    </div>
  </div>
</template>
