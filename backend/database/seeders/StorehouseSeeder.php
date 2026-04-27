<?php

namespace Database\Seeders;

use App\Models\Color;
use App\Models\Inventory;
use App\Models\ProductCategory;
use App\Models\Profile;
use Illuminate\Database\Seeder;

class StorehouseSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['category_code' => 'STD', 'category_name' => 'Standard Profiles', 'category_name_ar' => 'المقاطع القياسية', 'sort_order' => 1],
            ['category_code' => 'SLD', 'category_name' => 'Sliding System', 'category_name_ar' => 'نظام السحاب', 'sort_order' => 2],
            ['category_code' => 'HNG', 'category_name' => 'Hinged System', 'category_name_ar' => 'النظام المفصلي', 'sort_order' => 3],
            ['category_code' => 'SHT', 'category_name' => 'Shutter System', 'category_name_ar' => 'نظام الشتر', 'sort_order' => 4],
            ['category_code' => 'CWL', 'category_name' => 'Curtain Wall', 'category_name_ar' => 'الكرتن وول', 'sort_order' => 5],
        ];
        foreach ($categories as $c) {
            ProductCategory::updateOrCreate(['category_code' => $c['category_code']], $c);
        }

        $profiles = [
            ['profile_id' => 'ST1001', 'category_code' => 'STD', 'name' => 'زاوية 1 سم', 'thickness_mm' => 1.2, 'weight_kg_per_m' => 0.18, 'usage' => 'تثبيت خفيف'],
            ['profile_id' => 'ST1002', 'category_code' => 'STD', 'name' => 'زاوية 2 سم', 'thickness_mm' => 1.4, 'weight_kg_per_m' => 0.32, 'usage' => 'تقويات إطارات'],
            ['profile_id' => 'ST1003', 'category_code' => 'STD', 'name' => 'U Channel صغير', 'thickness_mm' => 1.2, 'weight_kg_per_m' => 0.4, 'usage' => 'مسارات زجاج'],
            ['profile_id' => 'ST1004', 'category_code' => 'STD', 'name' => 'T Profile', 'thickness_mm' => 1.5, 'weight_kg_per_m' => 0.55, 'usage' => 'تقسيم داخلي'],
            ['profile_id' => 'ST1005', 'category_code' => 'STD', 'name' => 'أنبوب مربع 2×2', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 0.95, 'usage' => 'دعم إنشائي خفيف'],
            ['profile_id' => 'ST1006', 'category_code' => 'STD', 'name' => 'شريط مسطح 3×1', 'thickness_mm' => 1.2, 'weight_kg_per_m' => 0.35, 'usage' => 'تسليح داخلي'],
            ['profile_id' => 'ST1007', 'category_code' => 'STD', 'name' => 'زاوية L كبيرة', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 0.8, 'usage' => 'دعم هيكلي'],
            ['profile_id' => 'ST1008', 'category_code' => 'STD', 'name' => 'I Beam صغير', 'thickness_mm' => 2.2, 'weight_kg_per_m' => 1.15, 'usage' => 'دعم ثقيل'],
            ['profile_id' => 'ST1009', 'category_code' => 'STD', 'name' => 'H Profile', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.2, 'usage' => 'وصلات صناعية'],
            ['profile_id' => 'ST1010', 'category_code' => 'STD', 'name' => 'Flat Bar عريض', 'thickness_mm' => 1.5, 'weight_kg_per_m' => 0.6, 'usage' => 'تشطيبات'],
            ['profile_id' => 'SL2001', 'category_code' => 'SLD', 'name' => 'مسار سفلي سحاب', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.1, 'usage' => 'قاعدة الدفة'],
            ['profile_id' => 'SL2002', 'category_code' => 'SLD', 'name' => 'مسار علوي سحاب', 'thickness_mm' => 1.6, 'weight_kg_per_m' => 0.95, 'usage' => 'توجيه الحركة'],
            ['profile_id' => 'SL2003', 'category_code' => 'SLD', 'name' => 'دفة سحاب', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.35, 'usage' => 'جناح الشباك'],
            ['profile_id' => 'SL2004', 'category_code' => 'SLD', 'name' => 'قائم جانبي', 'thickness_mm' => 1.6, 'weight_kg_per_m' => 1.05, 'usage' => 'تثبيت جانبي'],
            ['profile_id' => 'SL2005', 'category_code' => 'SLD', 'name' => 'غطاء مسار', 'thickness_mm' => 1.2, 'weight_kg_per_m' => 0.6, 'usage' => 'تغطية جمالية'],
            ['profile_id' => 'SL2006', 'category_code' => 'SLD', 'name' => 'مجرى علوي', 'thickness_mm' => 1.5, 'weight_kg_per_m' => 0.9, 'usage' => 'تثبيت العلوي'],
            ['profile_id' => 'SL2007', 'category_code' => 'SLD', 'name' => 'مجرى سفلي عميق', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.2, 'usage' => 'توجيه دفة ثقيلة'],
            ['profile_id' => 'SL2008', 'category_code' => 'SLD', 'name' => 'دفة وسطية', 'thickness_mm' => 1.6, 'weight_kg_per_m' => 1.1, 'usage' => 'تقسيم داخلي'],
            ['profile_id' => 'SL2009', 'category_code' => 'SLD', 'name' => 'غطاء جانبي', 'thickness_mm' => 1.2, 'weight_kg_per_m' => 0.55, 'usage' => 'حماية الحركة'],
            ['profile_id' => 'SL2010', 'category_code' => 'SLD', 'name' => 'إطار كلي', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.5, 'usage' => 'إطار كامل للنظام'],
            ['profile_id' => 'HG3001', 'category_code' => 'HNG', 'name' => 'إطار باب مفصلي', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.6, 'usage' => 'إطار رئيسي'],
            ['profile_id' => 'HG3002', 'category_code' => 'HNG', 'name' => 'دفة باب', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.8, 'usage' => 'جناح الباب'],
            ['profile_id' => 'HG3003', 'category_code' => 'HNG', 'name' => 'قائم مفصلة', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.3, 'usage' => 'تثبيت المفصلات'],
            ['profile_id' => 'HG3004', 'category_code' => 'HNG', 'name' => 'عتب علوي', 'thickness_mm' => 1.6, 'weight_kg_per_m' => 1.0, 'usage' => 'دعم علوي'],
            ['profile_id' => 'HG3005', 'category_code' => 'HNG', 'name' => 'ضلفة زجاج', 'thickness_mm' => 1.6, 'weight_kg_per_m' => 1.2, 'usage' => 'احتواء الزجاج'],
            ['profile_id' => 'HG3006', 'category_code' => 'HNG', 'name' => 'إطار داخلي', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.35, 'usage' => 'أبواب داخلية'],
            ['profile_id' => 'HG3007', 'category_code' => 'HNG', 'name' => 'إطار خارجي', 'thickness_mm' => 2.2, 'weight_kg_per_m' => 1.9, 'usage' => 'أبواب خارجية'],
            ['profile_id' => 'HG3008', 'category_code' => 'HNG', 'name' => 'قائم جانبي مفصلي', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.45, 'usage' => 'تثبيت الجانبين'],
            ['profile_id' => 'HG3009', 'category_code' => 'HNG', 'name' => 'رف علوي', 'thickness_mm' => 1.6, 'weight_kg_per_m' => 1.1, 'usage' => 'دعم علوي خفيف'],
            ['profile_id' => 'HG3010', 'category_code' => 'HNG', 'name' => 'إطار تثبيت متعدد', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.75, 'usage' => 'وصلات قوية'],
            ['profile_id' => 'SH4001', 'category_code' => 'SHT', 'name' => 'شريحة شتر', 'thickness_mm' => 1.2, 'weight_kg_per_m' => 0.75, 'usage' => 'جسم الشتر'],
            ['profile_id' => 'SH4002', 'category_code' => 'SHT', 'name' => 'قائم جانبي', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.4, 'usage' => 'تثبيت'],
            ['profile_id' => 'SH4003', 'category_code' => 'SHT', 'name' => 'صندوق علوي', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 2.1, 'usage' => 'تجميع الشتر'],
            ['profile_id' => 'SH4004', 'category_code' => 'SHT', 'name' => 'سكة جانبية', 'thickness_mm' => 1.6, 'weight_kg_per_m' => 1.25, 'usage' => 'حركة'],
            ['profile_id' => 'SH4005', 'category_code' => 'SHT', 'name' => 'غطاء صندوق', 'thickness_mm' => 1.4, 'weight_kg_per_m' => 0.95, 'usage' => 'حماية'],
            ['profile_id' => 'SH4006', 'category_code' => 'SHT', 'name' => 'دفة شتر صغيرة', 'thickness_mm' => 1.5, 'weight_kg_per_m' => 1.05, 'usage' => 'فتح/إغلاق'],
            ['profile_id' => 'SH4007', 'category_code' => 'SHT', 'name' => 'دفة شتر كبيرة', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.6, 'usage' => 'فتح/إغلاق'],
            ['profile_id' => 'SH4008', 'category_code' => 'SHT', 'name' => 'إطار شتر', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.9, 'usage' => 'تثبيت كامل'],
            ['profile_id' => 'SH4009', 'category_code' => 'SHT', 'name' => 'غطاء جانبي صغير', 'thickness_mm' => 1.2, 'weight_kg_per_m' => 0.65, 'usage' => 'حماية جانبية'],
            ['profile_id' => 'SH4010', 'category_code' => 'SHT', 'name' => 'إطار علوي شتر', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 2.0, 'usage' => 'تثبيت نظام'],
            ['profile_id' => 'CW5001', 'category_code' => 'CWL', 'name' => 'Mullion رأسي', 'thickness_mm' => 2.5, 'weight_kg_per_m' => 2.8, 'usage' => 'عمود رأسي'],
            ['profile_id' => 'CW5002', 'category_code' => 'CWL', 'name' => 'Transom أفقي', 'thickness_mm' => 2.3, 'weight_kg_per_m' => 2.4, 'usage' => 'دعم أفقي'],
            ['profile_id' => 'CW5003', 'category_code' => 'CWL', 'name' => 'غطاء خارجي', 'thickness_mm' => 1.8, 'weight_kg_per_m' => 1.2, 'usage' => 'تثبيت زجاج'],
            ['profile_id' => 'CW5004', 'category_code' => 'CWL', 'name' => 'حامل زجاج', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.75, 'usage' => 'دعم ألواح'],
            ['profile_id' => 'CW5005', 'category_code' => 'CWL', 'name' => 'وصلة تمدد', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.5, 'usage' => 'تمدد حراري'],
            ['profile_id' => 'CW5006', 'category_code' => 'CWL', 'name' => 'إطار داخلي', 'thickness_mm' => 2.2, 'weight_kg_per_m' => 2.0, 'usage' => 'دعم داخلي'],
            ['profile_id' => 'CW5007', 'category_code' => 'CWL', 'name' => 'إطار خارجي', 'thickness_mm' => 2.5, 'weight_kg_per_m' => 2.85, 'usage' => 'تثبيت خارجي'],
            ['profile_id' => 'CW5008', 'category_code' => 'CWL', 'name' => 'غطاء جانبي', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.65, 'usage' => 'حماية جانبية'],
            ['profile_id' => 'CW5009', 'category_code' => 'CWL', 'name' => 'حامل علوي', 'thickness_mm' => 2.2, 'weight_kg_per_m' => 1.8, 'usage' => 'دعم علوي'],
            ['profile_id' => 'CW5010', 'category_code' => 'CWL', 'name' => 'وصلة مفصلية', 'thickness_mm' => 2.0, 'weight_kg_per_m' => 1.55, 'usage' => 'تمدد حراري'],
        ];
        foreach ($profiles as $p) {
            Profile::updateOrCreate(['profile_id' => $p['profile_id']], $p);
        }

        $colors = [
            ['color_code' => 'RAL1013', 'name' => 'أبيض لؤلؤي', 'type' => 'RAL'],
            ['color_code' => 'RAL9005', 'name' => 'أسود', 'type' => 'RAL'],
            ['color_code' => 'RAL7016', 'name' => 'رمادي داكن', 'type' => 'RAL'],
            ['color_code' => 'RAL8017', 'name' => 'بني شوكولا', 'type' => 'RAL'],
            ['color_code' => 'RAL9006', 'name' => 'فضي معدني', 'type' => 'RAL'],
            ['color_code' => 'RAL9001', 'name' => 'أبيض عاجي', 'type' => 'RAL'],
            ['color_code' => 'RAL7035', 'name' => 'رمادي فاتح', 'type' => 'RAL'],
            ['color_code' => 'RAL3020', 'name' => 'أحمر إشارات', 'type' => 'RAL'],
            ['color_code' => 'RAL5010', 'name' => 'أزرق غامق', 'type' => 'RAL'],
            ['color_code' => 'RAL6018', 'name' => 'أخضر ليموني', 'type' => 'RAL'],
            ['color_code' => 'WHITE', 'name' => 'White', 'type' => 'basic'],
            ['color_code' => 'BLACK', 'name' => 'Black', 'type' => 'basic'],
        ];
        foreach ($colors as $c) {
            Color::updateOrCreate(['color_code' => $c['color_code']], $c);
        }

        // Seed inventory: one row per profile+color with demo stock (10–30 units) for sales / supervisor flows
        $profileIds = Profile::pluck('id')->toArray();
        $colorCodes = Color::pluck('color_code')->toArray();
        foreach ($profileIds as $profileId) {
            foreach ($colorCodes as $colorCode) {
                $qty = random_int(10, 30);
                Inventory::updateOrCreate(
                    ['profile_id' => $profileId, 'color_code' => $colorCode],
                    ['quantity' => $qty]
                );
            }
        }
    }
}
