# 🧠 My Brain LM — Frontend SPA

Esta carpeta contiene la interfaz web (Single Page Application) para interactuar con **My Brain LM** utilizando React, TypeScript y Vite.

---

## 🗺️ Estado del Proyecto y Fases del Frontend

A continuación se detalla la lista de fases de desarrollo implementadas y pendientes en el cliente frontend:

- [x] **Fase 2: MVP Frontend — COMPLETADA ✅**
  - [x] Interfaz de chat interactiva con streaming SSE
  - [x] Carga de documentos local con Drag & Drop
  - [x] Integración de referencias de fuentes con score de relevancia RAG
  - [x] Dashboard oscuro premium con diseño responsivo

- [x] **Fase 3: Multi-Áreas (Multi-Cerebro) — COMPLETADA ✅**
  - [x] Soporte para múltiples áreas temáticas independientes (namespaces de ChromaDB)
  - [x] Creación de áreas con nombre, descripción y selección de colores personalizados
  - [x] Historial de conversaciones persistente por área
  - [x] Gestión de estado en URL con `react-router-dom` para navegación persistente (F5, Atrás/Adelante)
  - [x] Modal premium flotante "Brain Status" para estadísticas RAG globales, aislado para máximo rendimiento
  - [x] Identificadores UUIDv4 string profesionales en bases de datos y llamadas de API
  - [x] Burbujas de área dinámicas con relleno de color, hover suave y efecto de resplandor

- [ ] **Fase 4: Features Avanzadas — PENDIENTE 🔜**
  - [ ] Web scraping para generación de documentos desde URLs
  - [ ] Visualización avanzada de artefactos de código y previews HTML interactivos
  - [ ] Historial de versiones y carga asistida por IA

---

## 🚀 Cómo Iniciar el Frontend

### Pre-requisitos
* Tener instalado [Node.js](https://nodejs.org/) (versión 18+)
* Tener instalado el gestor de paquetes [pnpm](https://pnpm.io/)

### Configuración e Instalación
```bash
# 1. Instalar dependencias
pnpm install

# 2. Iniciar el servidor de desarrollo de Vite
pnpm run dev
```

El servidor web estará disponible en `http://localhost:5173`. Asegúrate de tener el backend corriendo en `http://localhost:8000`.

---

## 🛠️ Tecnologías y Dependencias
* **Core:** React 19, Vite, TypeScript.
* **Manejo de Rutas (State):** React Router DOM.
* **Componentes RAG Headless:** `@assistant-ui/react` y `@assistant-ui/react-markdown`.
* **Iconografía:** `lucide-react`.
* **Estilos:** Tailwind CSS v4.
