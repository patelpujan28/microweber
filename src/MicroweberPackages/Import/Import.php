<?php
namespace MicroweberPackages\Import;

use MicroweberPackages\Backup\Loggers\DefaultLogger;
use MicroweberPackages\Import\Formats\CsvReader;
use MicroweberPackages\Import\Formats\JsonReader;
use MicroweberPackages\Import\Formats\XlsxReader;
use MicroweberPackages\Import\Formats\XmlReader;
use MicroweberPackages\Import\Formats\ZipReader;
use MicroweberPackages\Import\Loggers\ImportLogger;
use MicroweberPackages\Multilanguage\MultilanguageHelpers;

class Import
{

    public $step = 0;

	/**
	 * The import file type
	 *
	 * @var string
	 */
	public $type;

	/**
	 * The import file path
	 *
	 * @var string
	 */
	public $file;

    /**
     * The import language
     * @var string
     */
	public $language = 'en';

    public $batchImporting = true;
    public $ovewriteById = false;
    public $deleteOldContent = false;


	public function setStep($step)
    {
        $this->step = intval($step);
    }

	/**
	 * Set file type
	 *
	 * @param string $file
	 */
	public function setType($type)
	{
		$this->type = $type;
	}

    /**
     * Set import file path
     * @param string $file
     */
    public function setFile($file)
    {
        if (!is_file($file)) {
            return array('error' => 'Backup Manager: You have not provided a existing backup to restore.');
        }

        $this->setType(pathinfo($file, PATHINFO_EXTENSION));
        $this->file = $file;
    }

	public function setLanguage($abr) {
	    $this->language = trim($abr);
    }

    public function setBatchImporting($batchImporting)
    {
        $this->batchImporting = $batchImporting;
    }


    public function setOvewriteById($overwrite)
    {
        $this->ovewriteById = $overwrite;
    }

    public function setToDeleteOldContent($delete)
    {
        $this->deleteOldContent = $delete;
    }

    /**
     * Set logger
     * @param class $logger
     */
    public function setLogger($logger)
    {
        ImportLogger::setLogger($logger);
    }


    /**
     * Start importing
     * @return array
     */
    public function start()
    {
        MultilanguageHelpers::setMultilanguageEnabled(false);

        try {
            $content = $this->readContent();

            if (isset($content['error'])) {
                return $content;
            }

            if (isset($content['must_choice_language']) && $content['must_choice_language']) {
                return $content;
            }

            $writer = new DatabaseWriter();
            $writer->setStep($this->step);
            $writer->setContent($content['data']);
            $writer->setOverwriteById($this->ovewriteById);
            $writer->setDeleteOldContent($this->deleteOldContent);

            if ($this->batchImporting) {
                $writer->runWriterWithBatch();
            } else {
                $writer->runWriter();
            }

            return $writer->getImportLog();

        } catch (\Exception $e) {
            return array("file" => $e->getFile(), "line" => $e->getLine(), "error" => $e->getMessage());
        }
    }

	/**
	 * Import data as type
	 *
	 * @param array $data
	 * @return array
	 */
	public function importAsType($file)
	{
		$readedData = $this->_getReader($file);
		if ($readedData) {

            if (isset($readedData['must_choice_language']) && $readedData['must_choice_language']) {
                return $readedData;
            }

            ImportLogger::setLogInfo('Reading data from file ' . basename($this->file));

			if (! empty($readedData)) {
				$successMessages = count($readedData, COUNT_RECURSIVE) . ' items are readed.';
				ImportLogger::setLogInfo($successMessages);
				return array(
					'success' => $successMessages,
					'imoport_type' => $this->type,
					'data' => $readedData
				);
			}
		}

		$formatNotSupported = 'Import format not supported';
		ImportLogger::setLogInfo($formatNotSupported);

		throw new \Exception($formatNotSupported);
	}

	public function readContent()
	{
        if ($this->step == 0) {
            ImportLogger::setLogInfo('Start importing session..');
        }

		return $this->importAsType($this->file);
	}

	private function _recognizeDataTableName($data)
	{
		$tables = $this->_getTableList();

		$filename = basename($this->file);
		$fileExtension = get_file_extension($this->file);

		if ($fileExtension == 'zip') {
			return $data;
		}

		$importToTable = str_replace('.' . $fileExtension, false, $filename);

		$foundedTable = false;
		foreach ($tables as $table) {
			if (strpos($importToTable, $table) !== false) {
				$foundedTable = $table;
				break;
			}
		}

		if ($foundedTable) {
			return array(
				$foundedTable => $data
			);
		}

		return $data;
	}

	private function _getTableList()
	{
		$readyTables = array();

		$tables = mw()->database_manager->get_tables_list();
		foreach ($tables as $table) {
			$readyTables[] = str_replace(mw()->database_manager->get_prefix(), false, $table);
		}

		return $readyTables;
	}

	/**
	 * Get file reader by type
	 *
	 * @param array $data
	 * @return boolean|\MicroweberPackages\Import\Formats\DefaultReader
	 */
	private function _getReader($data = array())
	{
	    switch ($this->type) {
			case 'json':
				$reader = new JsonReader($data);
				break;

			case 'csv':
				$reader = new CsvReader($data);
				break;

			case 'xml':
				$reader = new XmlReader($data);
				break;

			case 'xlsx':
				$reader = new XlsxReader($data);
				break;

			case 'zip':
				$reader = new ZipReader($data);
				$reader->setLanguage($this->language);
				break;

			default:
				throw new \Exception('Format not supported for importing.');
				break;
		}

		$data = $reader->readData();

		return $this->_recognizeDataTableName($data);
	}
}