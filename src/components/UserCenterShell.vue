<template>
  <section class="page-container user-shell">
    <aside class="user-sidebar surface">
      <RouterLink to="/orders">我的订单</RouterLink>
      <RouterLink to="/tickets/change">退票与改签</RouterLink>
      <RouterLink to="/passengers">常用乘车人</RouterLink>
      <RouterLink to="/profile">个人资料</RouterLink>
    </aside>
    <div class="content-card surface"><slot /></div>
  </section>
</template>
