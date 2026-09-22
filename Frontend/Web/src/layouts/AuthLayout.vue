<script setup lang="ts">
import { ArrowUpRight, Check, Wrench } from '@lucide/vue';
</script>

<template>
  <div class="auth-page">
    <header class="brand-header">
      <RouterLink to="/" class="brand"><span class="brand-symbol"><Wrench :size="22" /></span>fixflow<span class="brand-dot">.</span></RouterLink>
      <span class="header-note">Little fixes. Better places.</span>
      <RouterLink to="/register" class="header-link">Join your community <ArrowUpRight :size="17" /></RouterLink>
    </header>
    <main class="auth-grid">
      <section class="story-panel">
        <div class="story-copy"><span class="eyebrow"><span></span> A LITTLE CARE GOES A LONG WAY</span>
          <h1>Good spaces.<br />Happy people.<br /><span>Let’s keep it that way.</span></h1>
          <p>From a leaky tap to a flickering light, help make the places you share feel a little more like home.</p>
        </div>
        <div class="campus-photo">
          <img src="https://images.unsplash.com/photo-1583373834259-46cc92173cb7?auto=format&fit=crop&w=1400&q=85" alt="Warm evening light over a university campus and its green courtyard" />
          <div class="photo-caption"><span>SPACES WORTH CARING FOR</span><strong>A better day starts here.</strong></div>
          <a class="photo-credit" href="https://unsplash.com/photos/k4vFDPJoDZk" target="_blank" rel="noopener noreferrer">Photo: Camilo Botia / Unsplash ↗</a>
          <div class="care-sticker"><Check :size="18" /><span>A little fix.<br /><b>A big difference.</b></span></div>
        </div>
        <div class="story-bottom"><span><i class="color-dot coral"></i> Report it.</span><span><i class="color-dot mint"></i> Track it.</span><span><i class="color-dot citron"></i> Feel at home.</span></div>
      </section>
      <section class="auth-form-panel"><RouterView /></section>
    </main>
    <footer class="auth-footer"><span>Made for the places we share.</span><span>Schools · Hostels · Hotels <span class="footer-spark">✳</span></span></footer>
  </div>
</template>
