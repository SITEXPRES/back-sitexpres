<?php

namespace Nfse\Xml;

use DOMDocument;
use DOMNode;
use Nfse\Dto\Nfse\NfseData;

class NfseXmlParser
{
    public function parse(string $xml): NfseData
    {
        $dom = new DOMDocument;
        $dom->loadXML($xml);

        $data = $this->convertDomToArray($dom->documentElement);

        // Map root attributes
        if (isset($data['@versao'])) {
            $data['versao'] = $data['@versao'];
        }

        // Map InfNfse attributes
        if (isset($data['infNFSe']['@Id'])) {
            $data['infNFSe']['id'] = $data['infNFSe']['@Id'];
        }
        if (isset($data['infNFSe']['@versao'])) {
            $data['infNFSe']['versao'] = $data['infNFSe']['@versao'];
            if (! isset($data['versao'])) {
                $data['versao'] = $data['infNFSe']['@versao'];
            }
        }

        // Map DPS attributes if present
        if (isset($data['infNFSe']['DPS']['@versao'])) {
            $data['infNFSe']['DPS']['versao'] = $data['infNFSe']['DPS']['@versao'];
        }
        if (isset($data['infNFSe']['DPS']['infDPS']['@Id'])) {
            $data['infNFSe']['DPS']['infDPS']['id'] = $data['infNFSe']['DPS']['infDPS']['@Id'];
        }

        // Cast integers for InfNfseData
        $intFieldsNfse = ['tpEmis', 'cStat'];
        foreach ($intFieldsNfse as $field) {
            if (isset($data['infNFSe'][$field])) {
                $data['infNFSe'][$field] = (int) $data['infNFSe'][$field];
            }
        }

        return new NfseData($data);
    }

    private function convertDomToArray(DOMNode $node): array|string
    {
        $output = [];

        if ($node->nodeType === XML_TEXT_NODE) {
            return $node->nodeValue;
        }

        if ($node->hasAttributes()) {
            foreach ($node->attributes as $attr) {
                $output['@'.$attr->nodeName] = $attr->nodeValue;
            }
        }

        if ($node->hasChildNodes()) {
            foreach ($node->childNodes as $child) {
                if ($child->nodeType === XML_TEXT_NODE) {
                    $text = trim($child->nodeValue);
                    if ($text !== '') {
                        if (! empty($output)) {
                            $output['value'] = $text;
                        } else {
                            return $text;
                        }
                    }

                    continue;
                }

                if ($child->nodeType !== XML_ELEMENT_NODE) {
                    continue;
                }

                $childValue = $this->convertDomToArray($child);
                $childName = $child->nodeName;

                if (isset($output[$childName])) {
                    if (! is_array($output[$childName]) || ! isset($output[$childName][0])) {
                        $output[$childName] = [$output[$childName]];
                    }
                    $output[$childName][] = $childValue;
                } else {
                    $output[$childName] = $childValue;
                }
            }
        }

        return $output;
    }
}
