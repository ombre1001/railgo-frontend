<script setup lang="ts">
withDefaults(defineProps<{ light?: boolean; compact?: boolean }>(), { light: false, compact: false })
</script>

<template>
  <div class="brand" :class="{ 'brand-light': light }">
    <span class="brand-mark" />
    <span v-if="!compact" class="brand-text">RailGo 旅途</span>
  </div>
</template>

<style scoped>
.brand-light .brand-text { color: #fff; }
</style>
