# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).  
Las versiones siguen el proyecto npm (`package.json`).

## [0.1.0] - 2026-04-17

### Added

- PWA instalable (service worker, offline shell y rutas precacheadas donde aplica).
- Proyectos locales en IndexedDB (Dexie): polígono principal, vértices, POIs, fotos y cola de sincronización con Supabase Storage.
- Captura con GPS, cámara y galería; compresión cliente (WebP/JPEG) y miniaturas para listas.
- Mapa (MapLibre), dibujo de polígono, estadísticas y flujo de subpolígonos cuando aplica.
- Mapa satélite descargable para uso offline en ajustes.
- Reportes: exportación GeoJSON/KML, PNG para compartir y PDF (React PDF).
- Ajustes: ahorro de batería GPS, arrastre de vértices en mapa (opcional), checklist de testing en campo (Fase 5.5).
- Onboarding corto, empty states y mensajes de error/permisos orientados a uso en campo (incl. iOS).

### Changed

- Iteraciones de rendimiento (lazy-load de dependencias pesadas, analizador de bundle opcional).

### Security

- Las políticas RLS y Storage del SQL de ejemplo están pensadas para desarrollo; revisar antes de producción multiusuario (ver `docs/DEPLOY.md` y `supabase/README.md`).
