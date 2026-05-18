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

        $accessories = [
            ['profile_id' => 'ACC-GH-WALL',      'name' => 'Glass to Wall Hinge',          'usage' => 'Glass door fitting'],
            ['profile_id' => 'ACC-GH-GG',        'name' => 'Glass to Glass Hinge',         'usage' => 'Glass door fitting'],
            ['profile_id' => 'ACC-AL-HND-224',   'name' => 'Aluminium Handle 224',         'usage' => 'Window / door handle'],
            ['profile_id' => 'ACC-AL-HND-DLC',   'name' => 'Aluminium Handle DLC',         'usage' => 'Window / door handle'],
            ['profile_id' => 'ACC-UPVC-3DH',     'name' => '3D Hinge UPVC',                'usage' => 'UPVC door hinge'],
            ['profile_id' => 'ACC-UPVC-WGEAR',   'name' => 'Window Gear Lock',             'usage' => 'UPVC window gear'],
            ['profile_id' => 'ACC-LB-ZINC-4585', 'name' => 'Zinc Lock Body 45x85',         'usage' => 'Mortise lock body'],
            ['profile_id' => 'ACC-LB-SS-7255',   'name' => 'SS Lock Body 72x55',           'usage' => 'Mortise lock body'],
            ['profile_id' => 'ACC-DLOCK-55',     'name' => 'Dead Lock 55mm',               'usage' => 'Mortise dead lock'],
            ['profile_id' => 'ACC-HLOCK-50',     'name' => 'Hook Lock 50mm',               'usage' => 'Sliding door hook lock'],
            ['profile_id' => 'ACC-CYL-BR-70',    'name' => 'Brass Cylinder 70mm 5-key',    'usage' => 'Door cylinder'],
            ['profile_id' => 'ACC-CYL-KNOB-70',  'name' => 'Brass Cylinder Knob 70mm',     'usage' => 'Door cylinder knob'],
            ['profile_id' => 'ACC-HG-SS-4X3',    'name' => 'SS Hinge 4x3',                 'usage' => 'Door hinge'],
            ['profile_id' => 'ACC-HG-3D',        'name' => '3D Concealed Hinge',           'usage' => 'Concealed door hinge'],
            ['profile_id' => 'ACC-HND-SA19',     'name' => 'SS Door Handle SA-19',         'usage' => 'Lever door handle'],
            ['profile_id' => 'ACC-HND-MRL9611',  'name' => 'MRL 9611 Handle',              'usage' => 'Heavy duty lever handle'],
            ['profile_id' => 'ACC-DC-502',       'name' => 'Door Closer 502 65kg',         'usage' => 'Surface door closer'],
            ['profile_id' => 'ACC-DC-9024',      'name' => 'Door Closer 9024 120kg',       'usage' => 'Surface door closer'],
            ['profile_id' => 'ACC-PANIC-DK1510P','name' => 'Panic Bar DK-1510P',           'usage' => 'Emergency exit device'],
            ['profile_id' => 'ACC-PULL-HD',      'name' => 'Pull Handle D-Type',           'usage' => 'Pull handle'],
            ['profile_id' => 'ACC-PULL-HH',      'name' => 'Pull Handle H-Type',           'usage' => 'Pull handle'],
            ['profile_id' => 'ACC-SLIDE-100KG',  'name' => 'Sliding Door Wheel 100kg',     'usage' => 'Sliding door hardware'],
            ['profile_id' => 'ACC-BARN',         'name' => 'Barn Sliding System',          'usage' => 'Barn door kit'],
            ['profile_id' => 'ACC-DSTOP-RND',    'name' => 'Round Door Stopper',           'usage' => 'Door stopper'],
            ['profile_id' => 'ACC-DSTOP-MAG',    'name' => 'Magnet Door Stopper',          'usage' => 'Door stopper'],
            ['profile_id' => 'ACC-RIMLOCK',      'name' => 'Rim Lock',                     'usage' => 'Rim lock'],
            ['profile_id' => 'ACC-PAD-NORMAL-50','name' => 'Pad Lock Normal Key 50mm',     'usage' => 'Padlock'],
            ['profile_id' => 'ACC-PAD-COMP-50',  'name' => 'Pad Lock Computer Key 50mm',   'usage' => 'Padlock'],
            ['profile_id' => 'ACC-MAGLOCK',      'name' => 'Magnetic Electric Lock',       'usage' => 'Access control'],
            ['profile_id' => 'ACC-PANEL-MS705',  'name' => 'Panel Lock MS 705',            'usage' => 'Industrial panel lock'],
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

            $quantity = random_int(5, 200);
            $unitPrice = round(random_int(1000, 50000) / 100, 2);

            Inventory::updateOrCreate(
                ['profile_id' => $profile->id, 'color_code' => 'STD'],
                ['quantity' => $quantity, 'unit_price' => $unitPrice],
            );
        }
    }
}
