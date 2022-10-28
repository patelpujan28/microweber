<?php

namespace MicroweberPackages\Modules\Admin\ImportExportTool\Http\Livewire;

use Livewire\Component;
use MicroweberPackages\Modules\Admin\ImportExportTool\ImportMapping\HtmlDropdownMappingRecursiveTable;
use MicroweberPackages\Modules\Admin\ImportExportTool\ImportMapping\Readers\XmlToArray;
use MicroweberPackages\Modules\Admin\ImportExportTool\Models\ImportFeed;

class HtmlDropdownMappingPreview extends Component
{
    public $import_feed_id = 0;
    public $import_feed = [];
    public $data;
    public $listeners = [
        'htmlDropdownMappingPreviewRefresh'=>'readFeed'
    ];

    public function readFeed()
    {
        $importFeed = ImportFeed::where('id', $this->import_feed_id)->first();
        if ($importFeed == null) {
            return redirect(route('admin.import-export-tool.index'));
        }

        $this->import_feed = $importFeed->toArray();
        unset($this->import_feed['source_content']);

        $dropdownMapping = new HtmlDropdownMappingRecursiveTable();
        $dropdownMapping->setContent($importFeed->source_content);
        $dropdownMapping->setContentParentTags($importFeed->content_tag);
        $dropdownMapping->setImportTo($this->import_feed['import_to']);

        $this->data = $dropdownMapping->render();

        if (empty($this->import_feed['mapped_tags'])) {
            $this->import_feed['mapped_tags'] = $dropdownMapping->getAutomaticSelectedOptions();
        }
    }

    public function render()
    {
        if (isset($this->import_feed['mapped_tags']) && is_array($this->import_feed['mapped_tags'])) {
            $importFeed = ImportFeed::where('id', $this->import_feed['id'])->first();
            $importFeed->mapped_tags = $this->import_feed['mapped_tags'];
            $importFeed->save();
        }

        return view('import_export_tool::admin.livewire-html-dropdown-mapping-preview');
    }

    public function mount($importFeedId)
    {
        $this->import_feed_id = $importFeedId;
        $this->readFeed();
    }

}
