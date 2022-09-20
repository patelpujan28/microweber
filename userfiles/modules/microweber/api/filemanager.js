(function (){
    mw.require('filemanager.css');
    var FileManager = function (options) {

        var scope = this;

        options = options || {};

        var defaultRequest = function (params, callback, error) {
            var xhr = new XMLHttpRequest();
            scope.dispatch('beforeRequest', {xhr: xhr, params: params});
            xhr.onreadystatechange = function(e) {
                if (this.readyState === 4 && this.status === 200) {
                    callback.call(scope, JSON.parse(this.responseText), xhr);
                } else if(this.status !== 200) {
                    if(error) {
                        error.call(scope, e);
                    }
                }
            };
            xhr.addEventListener('error', function (e){
                if(error) {
                    error.call(scope, e);
                }
            });
            var url = scope.settings.url + '?' + new URLSearchParams(params || {}).toString();
            xhr.open("GET", url, true);
            xhr.send();
        };

        var defaults = {
            multiselect: true,
            selectable: true,
            canSelectFolder: false,
            options: true,
            element: null,
            query: {
                order: 'asc',
                orderBy: 'modified',
                path: '/'
            },
            backgroundColor: '#fafafa',
            stickyHeader: false,
            requestData: defaultRequest,
            url: mw.settings.site_url + 'api/file-manager/list',
            viewType: 'list' // 'list' | 'grid'
        };

        var _e = {};


        this.on = function (e, f) { _e[e] ? _e[e].push(f) : (_e[e] = [f]) };
        this.dispatch = function (e, f) { _e[e] ? _e[e].forEach(function (c){ c.call(this, f); }) : ''; };

        this.settings = mw.object.extend({}, defaults, options);

        var table, tableHeader, tableBody;


        var _checkName = 'select-fm-' + (new Date().getTime());

        var globalcheck, _pathNode, _backNode;

        var _check = function (name) {
            var input = document.createElement('input');
            input.type = (scope.settings.multiselect ? 'checkbox' : 'radio');
            input.name = name || _checkName;
            var root = mw.element('<label class="mw-ui-check"><span></span></label>');
            root.prepend(input);

            ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(function (ev){
                root.get(0).addEventListener(ev, function (e){
                   e.stopImmediatePropagation();
                   e.stopPropagation();
                });
            });

            return {
                root: root,
                input: mw.element(input),
            };
        };

        var _size = function (item, dc) {
            var bytes = item.size;
            if (typeof bytes === 'undefined' || bytes === null) return '';
            if (bytes === 0) return '0 Bytes';
            var k = 1000,
                dm = dc === undefined ? 2 : dc,
                sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
                i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        };



        var _image = function (item) {
            if (item.type === 'folder') {
                return '<span class="mw-file-manager-list-item-thumb mw-file-manager-list-item-thumb-folder"></span>';
            } else if (item.thumbnail) {
                return '<span class="mw-file-manager-list-item-thumb mw-file-manager-list-item-thumb-image" style="background-image: url(' + item.thumbnail + ')"></span>';
            } else {
                var ext = item.name.split('.').pop();
                if(!ext) {
                    ext = item.mimeType;
                }
                return '<span class="mw-file-manager-list-item-thumb mw-file-manager-list-item-thumb-file">' + (ext) + '</span>';
            }
        };

        var createOption = function (item, option) {
            if(!option.match(item)) {
                return '';
            }
            var el = mw.element({
                content: option.label
            });
            el.on('click', function (e){
                e.stopPropagation()
                option.action(item);
            });
            return el;
        };

        var _renameHandle = function (item) {
            mw.prompt(mw.lang('Enter new name'), function(){

            }, item.name);

        };

        var _downloadHandle = function (item) {

        };


        var _copyUrlHandle = function (item) {
            mw.tools.copy(item.url);
        };

        var _deleteHandle = function (item) {
            mw.confirm(mw.lang('Are you sure') + '?', function (){

            });
        };

        var _selectedUI = function () {
            if(!scope.settings.selectable || !scope.settings.multiselect) {
                return;
            }
            scope.root.removeClass('mw-fm-all-selected', 'mw-fm-none-selected', 'mw-fm-part-selected');
            if(scope.areAllSelected()) {
                scope.root.addClass('mw-fm-all-selected');
                globalcheck.input.prop('checked', true);
                globalcheck.input.prop('indeterminate', false);
            } else if(scope.areNoneSelected()) {
                scope.root.addClass('mw-fm-none-selected');
                globalcheck.input.prop('checked', false);
                globalcheck.input.prop('indeterminate', false);
            }  else {
                scope.root.addClass('mw-fm-part-selected');
                globalcheck.input.prop('checked', false);
                globalcheck.input.prop('indeterminate', true);
            }
        };


        var createOptions = function (item) {
            var options = [
                { label: 'Rename', action: _renameHandle, match: function (item) { return true } },
                { label: 'Download', action: _downloadHandle, match: function (item) { return item.type === 'file'; } },
                { label: 'Copy url', action: _copyUrlHandle, match: function (item) { return true } },
                { label: 'Delete', action: _deleteHandle, match: function (item) { return true } },
            ];
            var el = mw.element().addClass('mw-file-manager-list-item-options');
            el.append(mw.element({tag: 'span', content: '...', props: {tooltip:'options'}}).addClass('mw-file-manager-list-item-options-button'));
            var optsHolder = mw.element().addClass('mw-file-manager-list-item-options-list');
            el.on('click', function (e){
                e.stopPropagation()
                var all = scope.root.get(0).querySelectorAll('.mw-file-manager-list-item-options.active');
                for (var i = 0; i < all.length; i++ ) {
                    if (all[i] !== this) {
                        all[i].classList.remove('active');
                    }
                }
                el.toggleClass('active');
            });
            options.forEach(function (options){
                optsHolder.append(createOption(item, options));
            });
            if(!this.__bodyOptionsClick) {
                this.__bodyOptionsClick = true;
                var bch = function (e) {
                    var curr = e.target;
                    var clicksOption = false;
                  while (curr && curr !== document.body) {
                      if(curr.classList.contains('mw-file-manager-list-item-options')){
                          clicksOption = true;
                          break;
                      }
                      curr = curr.parentNode;
                  }
                  if(!clicksOption) {
                      var all = scope.root.get(0).querySelectorAll('.mw-file-manager-list-item-options.active');
                      for(var i = 0; i < all.length; i++ ) {
                          if (all[i] !== this) {
                              all[i].classList.remove('active')
                          }
                      }
                  }
                };
                document.body.addEventListener('mousedown', bch , false);
            }
            el.append(optsHolder);
            return el;
        };


        var _data = {data: []};

        this.setData = function (data) {
            _data = data;
        };

        this.updateData = function (data) {
            this.setData(data);
            setTimeout(function (){
                _selectedUI();
            }, 100);
            this.dispatch('dataUpdated', data);
        };

        this.getSelectableItems = function () {
            return this.getItems().filter(function (itm){
                return itm.type !== 'folder' || scope.settings.canSelectFolder;
            });
        };

        this.getItems = function () {
            return this.getData().data;
        };

        this.getData = function () {
            return _data;
        };

        this.loading = function (state) {
            console.log(scope.root.get(0))
            if(state) {
                mw.spinner({element: scope.root.get(0), size: 32, decorate: true}).show();
            } else {
                mw.spinner({element: scope.root.get(0), size: 32}).remove();
            }
        };


        this.requestData = function (params, cb) {
            this.settings.query = params;
            var _cb = function (data) {
                cb.call(undefined, data);
                scope.loading(false);
            };

            scope.loading(true);
            var err = function (er) {
                scope.loading(false);
            };

            this.settings.requestData(
                params, _cb, err
            );
        };




        var userDate = function (date) {
            var dt = new Date(date);
            return dt.toLocaleString();
        };

        this.find = function (item) {
            if (typeof item === 'number') {

            }
        };


        var _activeSort = {
            orderBy: this.settings.query.orderBy || 'modified',
            order: this.settings.query.order || 'desc',
        };

        this.sort = function (by, order, _request) {
            if(typeof _request === 'undefined') {
                _request = true;
            }
            if(!order){
                if(by === _activeSort.orderBy) {
                    if(_activeSort.order === 'asc') {
                        order = 'desc';
                    } else {
                        order = 'asc';
                    }
                } else {
                    order = 'asc';
                }
            }
            _activeSort.orderBy = by;
            _activeSort.order = order;
            this.settings.query.orderBy = _activeSort.orderBy;
            this.settings.query.order = _activeSort.order;

            mw.element('[data-sortable]', scope.root).each(function (){
                this.classList.remove('asc', 'desc');
                if(this.dataset.sortable === _activeSort.orderBy) {
                    this.classList.add(_activeSort.order);
                }
            });

            if(_request) {
                this.requestData(this.settings.query, function (res){
                    scope.setData(res);
                    scope.renderData();
                });
            }
        };

        this.search = function (keyword, _request) {
            if(typeof _request === 'undefined') {
                _request = true;
            }

            keyword = (keyword || '').trim();

            if(!keyword){
                delete this.settings.query.keyword;
                this.sort('modified', 'desc', false);
            } else {
                this.settings.query.keyword = keyword;
                this.sort('keyword', 'desc', false);
            }

            mw.element('[data-sortable]', scope.root).each(function (){
                this.classList.remove('asc', 'desc');
                if(this.dataset.sortable === _activeSort.orderBy) {
                    this.classList.add(_activeSort.order);
                }
            });

            if(_request) {
                this.requestData(this.settings.query, function (res){
                    scope.setData(res);
                    scope.renderData();
                });
            }
        }

        this.singleListView = function (item) {
            var row = mw.element({ tag: 'tr' });
            var cellImage = mw.element({ tag: 'td', content: _image(item), props: {className: 'mw-file-manager-list-item-thumb-image-cell'}  });
            var cellName = mw.element({ tag: 'td', content: item.name  });
            var cellSize = mw.element({ tag: 'td', content: _size(item) });

            var cellmodified = mw.element({ tag: 'td', content: userDate(item.modified)  });
            if(item.type === 'folder') {
                row.on('click', function (){
                    scope.path(scope.path() + '/' + item.name);
                });
            }
            if(this.settings.selectable) {

                if (this.settings.canSelectFolder || item.type === 'file') {
                    var check =  _check();
                    check.input.on('change', function () {
                         scope[!this.checked ? 'unselect' : 'select'](item);
                        _selectedUI();
                    });
                    row.append( mw.element({ tag: 'td', content: check.root, props: {className: 'mw-file-manager-list-item-check-cell'} }));
                } else {
                    row.append( mw.element({ tag: 'td'  }));
                }
            }
             row
                .append(cellImage)
                .append(cellName)
                .append(cellSize)
                .append(cellmodified);
            if(this.settings.options) {
                var cellOptions = mw.element({ tag: 'td', content: createOptions(item) });
                row.append(cellOptions);
            }
            return row;
        };

        var rows = [];

        var listViewBody = function () {
            rows = [];
            tableBody ? tableBody.remove() : '';
            tableBody =  mw.element({
                tag: 'tbody'
            });
            scope.renderData();
            return tableBody;
        };

        this.renderData = function (){
            tableBody.empty();
            rows = [];
            this._selected = [];
            if(globalcheck) {
                globalcheck.input.prop('indeterminate', false);
                globalcheck.input.prop('checked', false);
            }

            scope.getItems().forEach(function (item) {
                var row = scope.singleListView(item);
                rows.push({data: item, row: row});
                tableBody.append(row);
            });
        };


        this._selected = [];

        var pushUnique = function (obj) {
            if (scope._selected.indexOf(obj) === -1) {
                scope._selected.push(obj);
            }
        };


        var afterSelect = function (obj, state) {
            if(scope.settings.multiselect === false) {
                rows.forEach(function (r){
                    r.row.removeClass('selected');
                });
            }
            var curr = rows.find(function (row){
                return row.data === obj;
            });
            if(curr) {
                curr.row[state ? 'addClass' : 'removeClass']( 'selected' );
                var input = curr.row.find('input');
                input.prop('checked', state);
            }
            _selectedUI();
        };


        this.getSelected = function () {
            return this._selected;
        };


        this.areNoneSelected = function () {
            return this.getSelected().length === 0;
        };

        this.areAllSelected = function () {
             return this.getSelectableItems().length === this.getSelected().length;
        };

        this.selectAll = function () {
            rows.forEach(function (rowItem){
                scope.select(rowItem.data);
            });
        };
        this.selectNone = function () {
            rows.forEach(function (rowItem){
                scope.unselect(rowItem.data);
            });
        };

        this.selectAllToggle = function () {
            if(this.areAllSelected()){
                this.selectNone();
            } else {
                this.selectAll();
            }
        };

        this.select = function (obj) {
            if(obj.type === 'folder' && !this.settings.canSelectFolder) {
                return;
            }
            if (this.settings.multiselect) {
                pushUnique(obj);
            } else {
                this._selected = [obj];
            }
            afterSelect(obj, true);
        };


        this.unselect = function (obj) {
            this._selected.splice(this._selected.indexOf(obj), 1);
            afterSelect(obj, false);
        };

        this.back = function (){
            var curr = this.settings.query.path;
            if(!curr || curr === '/') {
                return;
            }
            curr = curr.split('/');
            curr.pop();
            this.settings.query.path = curr.join('/');
            this.path(this.settings.query.path );
        };

        var createMainBar = function (){
            var viewTypeSelectorRoot = mw.element({
                props: {
                    className: 'mw-file-manager-bar-view-type-selector'
                }
            });
            _backNode = mw.element({
                tag: 'button',
                props: {
                    className: 'btn btn-outline-primary btn-sm',
                    innerHTML: '<i class="mdi mdi-keyboard-backspace"></i> ' + mw.lang('Back')
                }
            });
            _backNode.on('click', function (){
                scope.back();
            });

            var viewTypeSelector = mw.select({
                element: viewTypeSelectorRoot.get(0),
                size: 'small',
                data: [
                    {title: mw.lang('List'), value: 'list'},
                    {title: mw.lang('Grid'), value: 'grid'},
                ]
            });
            viewTypeSelector.on('change', function (val){
                scope.viewType( val[0].value);
            });
            _pathNode = mw.element({
                props: {
                    className: 'mw-file-manager-bar-path'
                }
            });
            var _pathNodeRoot = mw.element({
                props: {
                    className: 'mw-file-manager-bar-path-root'
                }
            });
            _pathNodeRoot.append(_pathNode)

            var bar = mw.element({
                props: {
                    className: 'mw-file-manager-bar'
                }
            });
            bar
                .append(_backNode)
                .append(_pathNodeRoot)
                .append(viewTypeSelectorRoot);
            return bar;
        };

        var createListViewHeader = function () {
            var thCheck;
            if (scope.settings.selectable && scope.settings.multiselect ) {
                globalcheck = _check('select-fm-global-' + (new Date().getTime()));
                globalcheck.root.addClass('mw-file-manager-select-all-check');
                globalcheck.input.on('input', function () {
                    scope.selectAllToggle();
                });
                thCheck = mw.element({ tag: 'th', content: globalcheck.root  }).addClass('mw-file-manager-select-all-heading');
            } else {
                thCheck = mw.element({ tag: 'th', }).addClass('mw-file-manager-select-all-heading');
            }
            var thImage = mw.element({ tag: 'th', content: ''  });
            var thName = mw.element({ tag: 'th', content: '<span>Name</span>'  }).addClass('mw-file-manager-sortable-table-header');
            var thSize = mw.element({ tag: 'th', content: '<span>Size</span>'  }).addClass('mw-file-manager-sortable-table-header');
            var thModified = mw.element({ tag: 'th', content: '<span>Last modified</span>'  }).addClass('mw-file-manager-sortable-table-header');
            var thOptions = mw.element({ tag: 'th', content: ''  });
            var ths = [thCheck, thImage, thName, thSize, thModified, thOptions];

                ths.forEach(function (th){
                    th.css('backgroundColor', scope.settings.backgroundColor);
                    if(typeof scope.settings.stickyHeader === 'number') {
                        th.css('top', scope.settings.stickyHeader);
                    }
                });

            var tr = mw.element({
                tag: 'tr',
                content: ths
            });
            tableHeader =  mw.element({
                tag: 'thead',
                content: tr
            });
            tableHeader.addClass('sticky-' + (scope.settings.stickyHeader !== false && scope.settings.stickyHeader !== undefined));
            tableHeader.css('backgroundColor', scope.settings.backgroundColor);
            thName.dataset('sortable', 'name').on('click', function (){ scope.sort(this.dataset.sortable) });
            thSize.dataset('sortable', 'size').on('click', function (){ scope.sort(this.dataset.sortable) });
            thModified.dataset('sortable', 'modified').on('click', function (){ scope.sort(this.dataset.sortable) });

            return tableHeader;
        };

        var _view = function () {
            if(!table) {
                table =  mw.element('<table class="mw-file-manager-view-table" />');
                table.css('backgroundColor', scope.settings.backgroundColor);
                table
                    .append(createListViewHeader())
                    .append(listViewBody());
            } else {
                scope.renderData();
            }

            return table;
        };

        this.view = function () {
            this.root
                .empty()
                .append(createMainBar())
                .append(_view());
        };

        var createRoot = function (){
            scope.root = mw.element({
                props: {
                    className: 'mw-file-manager-root'
                }
            });
        };

        this.viewType = function (viewType, _forced) {
            if (!viewType) {
                return this.settings.viewType;
            }
            if(viewType !== this.settings.viewType || _forced) {
                this.settings.viewType = viewType;
                this.root.dataset('view', this.settings.viewType);
                this.dispatch('viewTypeChange', this.settings.viewType);
            }
        };

        var pathItem = function (path, html){
            var node = document.createElement('a');
            node.innerHTML = html || path.split('/').pop();
            node.addEventListener('click', function (e){
                e.preventDefault();
                scope.path(path);
            });
            return node;
        };

        this.path = function (path, _request){
            if(typeof _request === 'undefined') {
                _request = true;
            }
            if(typeof path === 'undefined'){
                return this.settings.query.path;
            }
            path = (path || '').trim();
            this.settings.query.path = path;
            path = path.split('/').map(function (itm){return itm.trim()}).filter(function (itm){return !!itm});
            _pathNode.empty();

            var showHome = path.length > 0;


            while (path.length) {
                _pathNode.prepend(pathItem(path.join('/')));
                path.pop();
            }

            if(showHome) {
                _pathNode.prepend(pathItem('', 'Home'));
                if(_backNode) {
                    _backNode.show();
                }

            } else {
                if(_backNode) {
                    _backNode.hide();
                }
            }
            if(_request) {
                scope.sort(scope.settings.query.orderBy, scope.settings.query.order, false);

                this.requestData(this.settings.query, function (res){
                    scope.setData(res);
                    scope.renderData();
                });
            }

        };

        this.init = function (){
            createRoot();
            this.requestData(this.settings.query, function (data){
                scope.updateData(data);
                scope.view();
                scope.path(scope.settings.query.path, false);
                scope.sort(scope.settings.query.orderBy, scope.settings.query.order, false);
            });
            if (this.settings.element) {
                mw.element(this.settings.element).empty().append(this.root);
            }

            this.viewType(this.settings.viewType, true);

        };
        this.init();
    };

    mw.FileManager = function (options) {
        return new FileManager(options);
    };
})();
