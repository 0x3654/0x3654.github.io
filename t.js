/*
    t — bootstrap-плагин Lampa (lampa.mx)

    Короткий адрес для ввода с пульта (user-site GitHub Pages, корень):
    https://0x3654.github.io/t.js

      • доустанавливает плагины (top, transmission-send) — при каждом
        старте, если плагина нет в списке; отключённые (выключенные)
        не трогает; чтобы плагин не вернулся — удалите сам t.js
      • один раз применяет настройки из CONFIG ниже (сервер топа,
        фильтры, TorrServer) и перезагружает приложение
      • повторно настройки применяются только после повышения VERSION —
        поправили CONFIG → подняли версию → при следующем запуске
        настройки перезапишутся заново (руками сделанное затрётся)
      • TorrServer: основная ссылка — сервер на micro, дополнительная —
        встроенный (http://127.0.0.1:8090). Активная ссылка выбирается
        пробой при каждом запуске: локальный TorrServer отвечает —
        «дополнительная», нет — «основная». Сам автозапуск встроенного
        TorrServer плагином не включается (нет моста в нативное меню) —
        один раз руками: Настройки → «Настройки» (внизу списка) →
        TorrServer/автозапуск. Ручной выбор ссылки уважается: изменили
        «Использовать ссылку» сами — bootstrap больше её не трогает
        (до повышения VERSION)
      • самолечение платформы Apple TV: если лампа определила платформу
        неверно (окно в момент старта было не 1920×1080 — тогда пункт
        «Настройки» с нативным меню пропадает), пересчитываем признак
        после загрузки, когда размеры окна уже устоялись, и чиним

    Установка: Настройки → Расширения → «+» → URL этого файла.

    Копия для длинного URL живёт в репо transmission-send (t.js) —
    при правке CONFIG синхронизировать оба файла.
*/

(function(){
    'use strict'

    var FLAG = '__lampa_boot'

    if(window[FLAG]) return
    window[FLAG] = true

    // поднять после правки CONFIG — настройки применятся заново
    var VERSION = '5'

    var CONFIG = {
        // status: 1 — включён; 0 — установлен выключенным (в списке есть,
        // не исполняется; включается штатно в Настройки → Расширения)
        plugins: [
            { url: 'https://0x3654.github.io/transmission-send/top.js', status: 1 },
            { url: 'https://0x3654.github.io/transmission-send/transmission-send.js', status: 1 },
            { url: 'https://0x3654.github.io/transmission-send/nnm-auto.js', status: 0 }
            // { url: 'https://0x3654.github.io/transmission-send/plex-sync.js', status: 1 }
        ],

        storage: {
            // сервер «Топа · трекеров» (tracker-top, публичный домен)
            top_server_url: 'https://top.0x3654.com',

            // TorrServer: основная — micro (tsdproxy), дополнительная —
            // встроенный TorrServer приложения (Apple TV/Android/macOS)
            torrserver_url: 'https://torrserver.tailnet.invalid',
            torrserver_url_two: 'http://127.0.0.1:8090',

            // фильтры топа (значения — как в настройках плагина top)
            top_min_quality:  '1080',
            top_voice_1:      'Дубляж',
            top_voice_2:      'Многоголосый',
            top_trackers_sort: 'seeds',
            top_hide_watched: 'true',
            top_trackers_only: 'true',
            top_ru_titles:    'true',
            top_no_cam:       'true',
            top_hide_series:  'false',

            // «Топ» вместо главной
            top_as_home: 'true'
        },

        // главное меню: скрыть всё, кроме Главная и Избранного
        // (наши «Топ · TMDB»/«Топ · трекеры» добавляются плагином top
        // и не попадают в скрытие); имена берём переводом ключей лампы —
        // работает при любом языке интерфейса
        menu_hide_keys: [
            'menu_feed',        // Лента
            'menu_movies',      // Фильмы
            'menu_multmovie',   // Мультфильмы
            'menu_tv',          // Сериалы
            'title_persons',    // Персоны
            'menu_catalog',     // Каталог
            'menu_filter',      // Фильтр
            'menu_relises',     // Релизы
            'menu_anime',       // Аниме
            'menu_history',     // История
            'title_subscribes', // Подписки
            'menu_timeline',    // Расписание
            'menu_torrents'     // Торренты
        ]
    }

    // отвечает ли локальный TorrServer (встроенный в приложение)
    function probeLocal(cb){
        var tries = 2

        ;(function attempt(){
            var xhr = new XMLHttpRequest()
            var done = false

            function finish(alive){
                if(done) return
                done = true

                if(alive || !--tries) cb(alive)
                else setTimeout(attempt, 400)
            }

            xhr.open('HEAD', 'http://127.0.0.1:8090', true)
            xhr.timeout = 1200
            xhr.onload = function(){ finish(xhr.status > 0) }
            xhr.onerror = xhr.ontimeout = function(){ finish(false) }

            try{ xhr.send() }
            catch(e){ finish(false) }
        })()
    }

    // «использовать ссылку»: два — локальный TorrServer жив, один — micro;
    // пробуем только там, где локальный вообще бывает, на остальном — «один»
    function pickLink(cb){
        var Lampa = window.Lampa
        var local = false

        try{
            local = Lampa.Platform.is('apple_tv') || Lampa.Platform.is('android') || Lampa.Platform.macOS()
        }
        catch(e){}

        if(!local) return cb('one')

        probeLocal(function(alive){ cb(alive ? 'two' : 'one') })
    }

    // похоже ли на Apple TV по текущему состоянию (вызывается после
    // загрузки — размеры окна уже устоялись, в отличие от старта лампы);
    // «ontouchstart» отсекает настоящий iPad (у tvOS тача нет)
    function looksLikeAppleTV(){
        var ua = (navigator.userAgent || '').toLowerCase()

        return (ua.indexOf('ipad') > -1 || ua.indexOf('appletv') > -1 || ua.indexOf('apple tv') > -1) &&
            !('ontouchstart' in window) &&
            window.innerWidth === 1920 && window.innerHeight === 1080
    }

    function init(){
        var Lampa = window.Lampa

        // имя в списке расширений (лампа берёт имя только из каталога cub)
        ;(function selfName(){
            try{
                var list = Lampa.Plugins.get()

                for(var i = 0; i < list.length; i++){
                    if((list[i].url || '').indexOf('/t.js') > -1){
                        list[i].name   = 'Запуск — настройка лампы'
                        list[i].author = '@0x3654'
                        list[i].descr  = 'Ставит плагины и применяет настройки (bootstrap)'
                    }
                }

                Lampa.Plugins.save()
            }
            catch(e){}
        })()

        // доустановить недостающие плагины
        var installed = Lampa.Plugins.get().map(function(p){ return p.url })

        CONFIG.plugins.forEach(function(plug){
            if(installed.indexOf(plug.url) === -1)
                Lampa.Plugins.add({ url: plug.url, status: plug.status, author: '@0x3654' })
        })

        // настройки — только при первом запуске (или после повышения VERSION)
        var MARKER = 'boot_ver'
        var LINK   = 'torrserver_use_link'
        var MEM    = 'boot_link_written'
        var reload = false

        try{
            if(Lampa.Storage.get(MARKER) !== VERSION){
                for(var key in CONFIG.storage) Lampa.Storage.set(key, CONFIG.storage[key])

                // главное меню: нативный редактор лампы скрывает пункты
                // по ИМЕНАМ (menu_hide); переводим ключи в текущий язык
                if(CONFIG.menu_hide_keys){
                    Lampa.Storage.set('menu_hide', CONFIG.menu_hide_keys.map(function(k){
                        return Lampa.Lang.translate(k)
                    }).filter(function(name){
                        return name && name.indexOf('menu_') !== 0 // непереведённый ключ — мимо
                    }))
                }

                Lampa.Storage.set(MARKER, VERSION)
                Lampa.Storage.set(MEM, '') // вернуться к авто-выбору ссылки

                reload = true
            }
        }
        catch(e){ reload = true }

        // платформа определилась неверно (не apple_tv), а по факту это она:
        // Platform.is читает localStorage при каждом вызове, поэтому
        // достаточно записать значение — пункт нативного меню вернётся
        try{
            if(Lampa.Platform.get() !== 'apple_tv' && looksLikeAppleTV()){
                Lampa.Storage.set('platform', 'apple_tv')

                reload = true
            }
        }
        catch(e){}

        // активная ссылка TorrServer — пробой при каждом запуске;
        // значение, изменённое не нами, трогаем только после VERSION
        var cur     = String(Lampa.Storage.get(LINK) || '')
        var written = String(Lampa.Storage.get(MEM) || '')

        function done(){
            if(reload) setTimeout(function(){ window.location.reload() }, 700)
        }

        if(!written || cur === written){
            pickLink(function(link){
                if(link !== cur || !written){
                    try{
                        Lampa.Storage.set(LINK, link)
                        Lampa.Storage.set(MEM, link)

                        reload = true
                    }
                    catch(e){}
                }

                done()
            })
        }
        else done()
    }

    if(window.appready) init()
    else Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready') init()
    })
})()
