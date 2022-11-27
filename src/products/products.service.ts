import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Product, ProductImage } from "./entities";
import { PaginationDto } from "../common/dtos/pagination.dto";
import { validate as isUuid } from "uuid";


@Injectable()
export class ProductsService {
  private readonly logger = new Logger("ProductsService");

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    private readonly dataSource: DataSource
  ) {
  }

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetail } = createProductDto;

      const product = this.productRepository.create({
        ...productDetail,
        images: images.map(image => this.productImageRepository.create({ url: image }))
      });

      await this.productRepository.save(product);

      return { ...product, images };

    } catch (error) {

      this.handleDBExceptions(error);

    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      relations: {
        images: true
      }
    });
    return products.map(({ images, ...rest }) => (
        {
          ...rest,
          images: images.map(img => img.url)
        }
      )
    );
  }

  async findOne(term: string) {

    let product: Product;
    if (isUuid(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder("prod");
      product = await queryBuilder.where(`title=:title or slug=:slug`, {
        title: term.toLowerCase(),
        slug: term.toLowerCase()
      }).leftJoinAndSelect("prod.images", "prod_images")
        .getOne();
    }

    if (!product) throw new NotFoundException(`Product with id ${term} not found`);
    return product;
  }

  async finOnePlane(term: string) {
    const { images = [], ...rest } = await this.findOne(term);
    return {
      ...rest,
      images: images.map(img => img.url)
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {

    const { images, ...toUpdate } = updateProductDto;
    const product = await this.productRepository.preload({
      id,
      ...toUpdate
    });

    if (!product) throw new NotFoundException(`Product with id: ${id} not found`);

    //CreateQueryRunner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();


    try {
      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id } });
        product.images = images.map(image => this.productImageRepository.create({ url: image }));
      }

      await queryRunner.manager.save(product);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      // await this.productRepository.save(product);

      return this.finOnePlane(id);
    } catch (e) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDBExceptions(e);
    }
  }

  async remove(id: string) {
    const productToRemove = await this.findOne(id);
    return await this.productRepository.remove(productToRemove);
  }

  private handleDBExceptions(error: any) {
    if (error.code === "23505") throw new BadRequestException(error.detail);

    this.logger.error(error);
    throw new InternalServerErrorException("Unexpected error, check server logs");
  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder("product");

    try {
      return await query.delete().where({}).execute();


    } catch (e) {
      this.handleDBExceptions(e);
    }
  }
}
