<?php

namespace Database\Seeders;

use App\Models\Color;
use App\Models\Inventory;
use App\Models\ProductCategory;
use App\Models\Profile;
use Illuminate\Database\Seeder;

/**
 * Seeds the "Accessories" catalog (door / window / glass hardware) sourced from
 * the Tamba Hardware reference catalogue. Idempotent: safe to run repeatedly.
 *
 * Schema reuse: accessories live in `product_categories` (code = ACCESSORIES)
 * and `profiles` + `inventory`, alongside aluminum profiles. They flow through
 * the same Order / OrderItem pipeline so receipts and analytics keep working.
 */
class AccessoriesSeeder extends Seeder
{
    public function run(): void
    {
        ProductCategory::updateOrCreate(
            ['category_code' => 'ACCESSORIES'],
            [
                'category_name' => 'Accessories',
                'category_name_ar' => 'إكسسوارات',
                'sort_order' => 50,
            ],
        );

        Color::updateOrCreate(
            ['color_code' => 'STD'],
            ['name' => 'Standard', 'type' => 'finish'],
        );

        // Deterministic quantity and unit_price per accessory so every fresh seed
        // (and every collaborator's clone) ends up with identical demo data.
        $accessories = [
            ['profile_id' => 'ACC-GH-WALL',      'name' => 'Glass to Wall Hinge',          'usage' => 'Glass door fitting',        'quantity' => 80,  'unit_price' => 45.00],
            ['profile_id' => 'ACC-GH-GG',        'name' => 'Glass to Glass Hinge',         'usage' => 'Glass door fitting',        'quantity' => 75,  'unit_price' => 48.00],
            ['profile_id' => 'ACC-AL-HND-224',   'name' => 'Aluminium Handle 224',         'usage' => 'Window / door handle',      'quantity' => 120, 'unit_price' => 18.50],
            ['profile_id' => 'ACC-AL-HND-DLC',   'name' => 'Aluminium Handle DLC',         'usage' => 'Window / door handle',      'quantity' => 110, 'unit_price' => 22.00],
            ['profile_id' => 'ACC-UPVC-3DH',     'name' => '3D Hinge UPVC',                'usage' => 'UPVC door hinge',           'quantity' => 90,  'unit_price' => 35.00],
            ['profile_id' => 'ACC-UPVC-WGEAR',   'name' => 'Window Gear Lock',             'usage' => 'UPVC window gear',          'quantity' => 60,  'unit_price' => 55.00],
            ['profile_id' => 'ACC-LB-ZINC-4585', 'name' => 'Zinc Lock Body 45x85',         'usage' => 'Mortise lock body',         'quantity' => 70,  'unit_price' => 40.00],
            ['profile_id' => 'ACC-LB-SS-7255',   'name' => 'SS Lock Body 72x55',           'usage' => 'Mortise lock body',         'quantity' => 65,  'unit_price' => 65.00],
            ['profile_id' => 'ACC-DLOCK-55',     'name' => 'Dead Lock 55mm',               'usage' => 'Mortise dead lock',         'quantity' => 85,  'unit_price' => 30.00],
            ['profile_id' => 'ACC-HLOCK-50',     'name' => 'Hook Lock 50mm',               'usage' => 'Sliding door hook lock',    'quantity' => 95,  'unit_price' => 28.00],
            ['profile_id' => 'ACC-CYL-BR-70',    'name' => 'Brass Cylinder 70mm 5-key',    'usage' => 'Door cylinder',             'quantity' => 100, 'unit_price' => 25.00],
            ['profile_id' => 'ACC-CYL-KNOB-70',  'name' => 'Brass Cylinder Knob 70mm',     'usage' => 'Door cylinder knob',        'quantity' => 90,  'unit_price' => 32.00],
            ['profile_id' => 'ACC-HG-SS-4X3',    'name' => 'SS Hinge 4x3',                 'usage' => 'Door hinge',                'quantity' => 150, 'unit_price' => 12.00],
            ['profile_id' => 'ACC-HG-3D',        'name' => '3D Concealed Hinge',           'usage' => 'Concealed door hinge',      'quantity' => 80,  'unit_price' => 38.00],
            ['profile_id' => 'ACC-HND-SA19',     'name' => 'SS Door Handle SA-19',         'usage' => 'Lever door handle',         'quantity' => 70,  'unit_price' => 42.00],
            ['profile_id' => 'ACC-HND-MRL9611',  'name' => 'MRL 9611 Handle',              'usage' => 'Heavy duty lever handle',   'quantity' => 55,  'unit_price' => 75.00],
            ['profile_id' => 'ACC-DC-502',       'name' => 'Door Closer 502 65kg',         'usage' => 'Surface door closer',       'quantity' => 50,  'unit_price' => 95.00],
            ['profile_id' => 'ACC-DC-9024',      'name' => 'Door Closer 9024 120kg',       'usage' => 'Surface door closer',       'quantity' => 40,  'unit_price' => 140.00],
            ['profile_id' => 'ACC-PANIC-DK1510P','name' => 'Panic Bar DK-1510P',           'usage' => 'Emergency exit device',     'quantity' => 25,  'unit_price' => 220.00],
            ['profile_id' => 'ACC-PULL-HD',      'name' => 'Pull Handle D-Type',           'usage' => 'Pull handle',               'quantity' => 100, 'unit_price' => 35.00],
            ['profile_id' => 'ACC-PULL-HH',      'name' => 'Pull Handle H-Type',           'usage' => 'Pull handle',               'quantity' => 95,  'unit_price' => 38.00],
            ['profile_id' => 'ACC-SLIDE-100KG',  'name' => 'Sliding Door Wheel 100kg',     'usage' => 'Sliding door hardware',     'quantity' => 110, 'unit_price' => 28.00],
            ['profile_id' => 'ACC-BARN',         'name' => 'Barn Sliding System',          'usage' => 'Barn door kit',             'quantity' => 20,  'unit_price' => 320.00],
            ['profile_id' => 'ACC-DSTOP-RND',    'name' => 'Round Door Stopper',           'usage' => 'Door stopper',              'quantity' => 180, 'unit_price' => 6.00],
            ['profile_id' => 'ACC-DSTOP-MAG',    'name' => 'Magnet Door Stopper',          'usage' => 'Door stopper',              'quantity' => 160, 'unit_price' => 9.50],
            ['profile_id' => 'ACC-RIMLOCK',      'name' => 'Rim Lock',                     'usage' => 'Rim lock',                  'quantity' => 60,  'unit_price' => 48.00],
            ['profile_id' => 'ACC-PAD-NORMAL-50','name' => 'Pad Lock Normal Key 50mm',     'usage' => 'Padlock',                   'quantity' => 130, 'unit_price' => 15.00],
            ['profile_id' => 'ACC-PAD-COMP-50',  'name' => 'Pad Lock Computer Key 50mm',   'usage' => 'Padlock',                   'quantity' => 100, 'unit_price' => 22.00],
            ['profile_id' => 'ACC-MAGLOCK',      'name' => 'Magnetic Electric Lock',       'usage' => 'Access control',            'quantity' => 30,  'unit_price' => 180.00],
            ['profile_id' => 'ACC-PANEL-MS705',  'name' => 'Panel Lock MS 705',            'usage' => 'Industrial panel lock',     'quantity' => 75,  'unit_price' => 24.00],
        ];

        foreach ($accessories as $a) {
            $profile = Profile::updateOrCreate(
                ['profile_id' => $a['profile_id']],
                [
                    'category_code' => 'ACCESSORIES',
                    'name' => $a['name'],
                    'thickness_mm' => null,
                    'weight_kg_per_m' => null,
                    'usage' => $a['usage'],
                ],
            );

            Inventory::updateOrCreate(
                ['profile_id' => $profile->id, 'color_code' => 'STD'],
                ['quantity' => $a['quantity'], 'unit_price' => $a['unit_price']],
            );
        }
    }
}
