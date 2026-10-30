<script setup lang="ts">
import { useLocale } from '@/i18n';
import { ArrowUpRight, Check, Wrench } from '@lucide/vue';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';

const { t } = useLocale();
</script>

<template>
  <div class="auth-page">
    <header class="brand-header">
      <RouterLink to="/" class="brand"><span class="brand-symbol"><Wrench :size="22" /></span>fixflow<span class="brand-dot">.</span></RouterLink>
      <span class="header-note">{{ t("Little fixes. Better places.") }}</span>
      <LanguageSelector />
      <RouterLink to="/register" class="header-link">{{ t("Join your community") }} <ArrowUpRight :size="17" /></RouterLink>
    </header>
    <main class="auth-grid">
      <section class="story-panel">
        <div class="story-copy"><span class="eyebrow"><span></span> {{ t("A LITTLE CARE GOES A LONG WAY") }}</span>
          <h2>{{ t("Good spaces.") }}<br />{{ t("Happy people.") }}<br /><span>{{ t("Let’s keep it that way.") }}</span></h2>
          <p>{{ t("From a leaky tap to a flickering light, help make the places you share feel a little more like home.") }}</p>
        </div>
        <div class="campus-photo">
          <img src="https://images.unsplash.com/photo-1583373834259-46cc92173cb7?auto=format&fit=crop&w=1400&q=85" :alt="t('Warm evening light over a university campus and its green courtyard')" />
          <div class="photo-caption"><span>{{ t("SPACES WORTH CARING FOR") }}</span><strong>{{ t("A better day starts here.") }}</strong></div>
          <a class="photo-credit" href="https://unsplash.com/photos/k4vFDPJoDZk" target="_blank" rel="noopener noreferrer">Photo: Camilo Botia / Unsplash ↗</a>
          <div class="care-sticker"><Check :size="18" /><span>{{ t("A little fix.") }}<br /><b>{{ t("A big difference.") }}</b></span></div>
        </div>
        <div class="story-bottom"><span><i class="color-dot coral"></i> {{ t("Report it.") }}</span><span><i class="color-dot mint"></i> {{ t("Track it.") }}</span><span><i class="color-dot citron"></i> {{ t("Feel at home.") }}</span></div>
      </section>
      <section class="auth-form-panel"><RouterView /></section>
    </main>
    <footer class="auth-footer"><span>{{ t("Made for the places we share.") }}</span><span>{{ t("Schools · Hostels · Hotels") }} <span class="footer-spark">✳</span></span></footer>
  </div>
</template>
