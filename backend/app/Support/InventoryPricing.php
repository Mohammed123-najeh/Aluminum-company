<?php

namespace App\Support;

use App\Models\Inventory;

/**
 * Deterministic list price per meter for an inventory row (quoting / UI).
 */
class InventoryPricing
{
    public static function unitPricePerM(Inventory $inv): float
    {
        $hash = crc32((string) $inv->id.'|'.$inv->color_code.'|'.$inv->profile_id);
        $base = 45 + ($hash % 220);

        return round($base + ($hash % 100) / 100, 2);
    }

    /**
     * When no inventory row exists for profile+color, use a deterministic quote (list price / m).
     */
    public static function unitPricePerMForProfileColor(int $profileId, string $colorCode): float
    {
        $hash = crc32($profileId.'|'.$colorCode);
        $base = 45 + ($hash % 220);

        return round($base + ($hash % 100) / 100, 2);
    }
}
