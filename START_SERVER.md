# 🚀 Cómo Ejecutar Candelita App

## ⚠️ IMPORTANTE: La app DEBE ejecutarse desde un servidor web

La aplicación usa módulos ES6 de JavaScript que **NO funcionan** si abres `index.html` directamente desde el explorador de archivos. Debes usar un servidor web local.

## 🎯 Solución Rápida: Usar Live Server en VS Code

### Opción 1: Live Server Extension (RECOMENDADO)

1. **Instalar Live Server en VS Code:**
   - Abre VS Code
   - Ve a Extensions (Ctrl+Shift+X)
   - Busca "Live Server" por Ritwick Dey
   - Haz clic en "Install"

2. **Ejecutar la app:**
   - Abre el archivo `index.html` en VS Code
   - Haz clic derecho en el archivo
   - Selecciona "Open with Live Server"
   - La app se abrirá automáticamente en tu navegador en `http://127.0.0.1:5500`

### Opción 2: Usar Node.js (si lo tienes instalado)

```bash
# Instalar http-server globalmente
npm install -g http-server

# Navegar a la carpeta del proyecto
cd "C:\Users\ElenaCanoCastillejo\OneDrive - IBM\Desktop\Candelita V4"

# Iniciar el servidor
http-server -p 8000

# Abrir en el navegador: http://localhost:8000
```

### Opción 3: Usar Python (si lo tienes instalado)

```bash
# Python 3
python -m http.server 8000

# Abrir en el navegador: http://localhost:8000
```

## ✅ Verificar que Funciona

Una vez que la app esté corriendo en un servidor, deberías ver:

1. **En la consola del navegador (F12):**
   ```
   🔥 Initializing Firebase...
   ✅ Firebase initialized successfully
   App loading...
   Auth state changed: No user
   No user authenticated, showing auth modal
   Opening auth modal
   ```

2. **En la pantalla:**
   - El modal de login/registro debe aparecer automáticamente
   - Puedes hacer clic en los botones
   - Todo debe ser interactivo

## 🐛 Si Sigues Teniendo Problemas

1. Asegúrate de que la URL en el navegador empiece con `http://` y NO con `file://`
2. Abre la consola del navegador (F12) y busca errores en rojo
3. Verifica que todos los archivos estén en la misma carpeta

## 📝 Archivos Necesarios

Asegúrate de tener todos estos archivos en la misma carpeta:
- ✅ index.html
- ✅ script.js
- ✅ style.css
- ✅ manifest.json
- ✅ iconoapp.png.png
- ✅ success.mp3
- ✅ success2.mp3